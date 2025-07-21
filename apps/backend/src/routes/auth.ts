import type { Database } from "@repo/db";
import { createClient } from "@repo/db";
import { Hono } from "hono";
import { AuthService } from "../services/auth-service";

const authRoutes = new Hono();

// JWT Secret（本番では環境変数から取得）
const JWT_SECRET = process.env.JWT_SECRET || "development-jwt-secret-key";

// Database connection helper
async function getDatabaseConnection(): Promise<Database> {
  const connection = await createClient();
  return connection.db;
}

// POST /register - ユーザー登録
authRoutes.post("/register", async (c) => {
  try {
    const body = await c.req.json();
    const database = await getDatabaseConnection();
    const authService = new AuthService(database, JWT_SECRET);

    const result = await authService.register(body);

    if (!result.success) {
      if (result.error === "Email already exists") {
        return c.json({ error: result.error }, 409);
      }
      if (result.error === "Validation failed") {
        return c.json(
          {
            error: result.error,
            details: "Invalid input data",
          },
          400,
        );
      }
      return c.json({ error: result.error }, 500);
    }

    return c.json(
      {
        success: true,
        data: result.data,
        message: "User registered successfully",
      },
      201,
    );
  } catch (_error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /login - ログイン
authRoutes.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const database = await getDatabaseConnection();
    const authService = new AuthService(database, JWT_SECRET);

    const result = await authService.login(body);

    if (!result.success) {
      return c.json({ error: result.error }, 401);
    }

    return c.json(
      {
        success: true,
        data: result.data,
        message: "Login successful",
      },
      200,
    );
  } catch (_error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /profile - プロフィール取得（JWT認証必須）
authRoutes.get("/profile", async (c) => {
  try {
    const user = c.get("user");
    const database = await getDatabaseConnection();
    const userOperations = new (await import("@repo/db")).UserOperations(
      database,
    );

    const userResult = await userOperations.findById(user.userId);

    if (!userResult.success || !userResult.data) {
      return c.json({ error: "User not found" }, 404);
    }

    const userData = userResult.data;

    return c.json({
      success: true,
      data: {
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          organizationId: userData.organizationId,
          emailVerified: userData.emailVerified,
          createdAt: userData.createdAt,
          updatedAt: userData.updatedAt,
        },
      },
    });
  } catch (_error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PUT /profile - プロフィール更新（JWT認証必須）
authRoutes.put("/profile", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const database = await getDatabaseConnection();
    const userOperations = new (await import("@repo/db")).UserOperations(
      database,
    );

    // 更新可能フィールドのみ抽出
    const updateData: { name?: string } = {};
    if (body.name && typeof body.name === "string") {
      updateData.name = body.name;
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: "No valid fields to update" }, 400);
    }

    const updateResult = await userOperations.update(user.userId, updateData);

    if (!updateResult.success || !updateResult.data) {
      return c.json({ error: "Profile update failed" }, 500);
    }

    const userData = updateResult.data;

    return c.json({
      success: true,
      data: {
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          organizationId: userData.organizationId,
          emailVerified: userData.emailVerified,
          updatedAt: userData.updatedAt,
        },
      },
      message: "Profile updated successfully",
    });
  } catch (_error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { authRoutes };
