import { createClient, GeneratedApiOperations, type Database } from "@repo/db";
import { naturalLanguageInputSchema } from "@repo/shared/api";
import { Hono } from "hono";
import { DynamicDeploymentService } from "../services/dynamic-deployment-service";
import { LLMService } from "../services/llm-service";

const generatorRoutes = new Hono();

// 動的デプロイメントサービスを取得
function getDynamicDeploymentService(): DynamicDeploymentService {
  // グローバルに設定されたサービスを使用
  const globalService = (
    globalThis as { dynamicDeploymentService?: DynamicDeploymentService }
  ).dynamicDeploymentService;
  if (globalService) {
    return globalService;
  }

  // テスト環境用のフォールバック
  return new DynamicDeploymentService(new Hono());
}

// Database connection helper
async function getDatabaseConnection(): Promise<Database> {
  const connection = await createClient();
  return connection.db;
}

// POST /create - API生成
generatorRoutes.post("/create", async (c) => {
  try {
    const body = await c.req.json();
    const user = c.get("user");

    // バリデーション
    const validationResult = naturalLanguageInputSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400,
      );
    }

    const database = await getDatabaseConnection();
    const generatedApiOperations = new GeneratedApiOperations(database);
    const llmService = new LLMService();

    // LLMでAPI生成
    const llmResult = await llmService.generateApiFromNaturalLanguage(
      validationResult.data,
    );
    if (!llmResult.success) {
      return c.json({ error: "API generation failed" }, 500);
    }

    // DBに保存
    if (!llmResult.data) {
      return c.json({ error: "Failed to generate API specification" }, 500);
    }

    const createResult = await generatedApiOperations.create({
      name: llmResult.data.name,
      description: llmResult.data.description,
      endpoint: llmResult.data.endpoint,
      method: llmResult.data.method,
      price: llmResult.data.price,
      currency: "USDC",
      generatedCode: llmResult.data.generatedCode,
      documentation: llmResult.data.documentation,
      status: "draft",
      userId: user.userId,
      organizationId: user.organizationId,
    });

    if (!createResult.success) {
      return c.json({ error: "Failed to save API" }, 500);
    }

    // 動的デプロイメントの実行（オプション）
    let deploymentInfo = null;
    const shouldDeploy = validationResult.data.autoDeploy !== false; // デフォルトはtrue

    if (shouldDeploy) {
      try {
        const deploymentService = getDynamicDeploymentService();
        if (createResult.data) {
          const deployResult = await deploymentService.deployGeneratedApi(
            llmResult.data,
            user.userId,
            createResult.data.id,
          );

          if (deployResult.success) {
            deploymentInfo = deployResult.data;

            // デプロイメント成功時はDBのステータスを更新
            await generatedApiOperations.update(createResult.data.id, {
              status: "active",
            });
          } else {
            console.warn("Dynamic deployment failed:", deployResult.error);
          }
        }
      } catch (deployError) {
        console.warn("Dynamic deployment error:", deployError);
      }
    }

    return c.json(
      {
        success: true,
        data: {
          api: createResult.data,
          deployment: deploymentInfo,
        },
      },
      201,
    );
  } catch (_error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /deploy/:id - 既存APIの動的デプロイ
generatorRoutes.post("/deploy/:id", async (c) => {
  try {
    const apiId = c.req.param("id");
    const user = c.get("user");

    // API情報を取得
    const database = await getDatabaseConnection();
    const generatedApiOperations = new GeneratedApiOperations(database);
    const apiResult = await generatedApiOperations.findById(apiId);

    if (!apiResult.success || !apiResult.data) {
      return c.json({ error: "API not found" }, 404);
    }

    // 権限チェック
    if (apiResult.data.userId !== user.userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    // 動的デプロイメントを実行
    const deploymentService = getDynamicDeploymentService();
    const apiSpec = {
      name: apiResult.data.name,
      description: apiResult.data.description,
      endpoint: apiResult.data.endpoint,
      method: apiResult.data.method as "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
      price: apiResult.data.price,
      generatedCode: apiResult.data.generatedCode,
      documentation: apiResult.data.documentation,
    };

    const deployResult = await deploymentService.deployGeneratedApi(
      apiSpec,
      user.userId,
      apiId,
    );

    if (!deployResult.success) {
      return c.json({ error: deployResult.error }, 500);
    }

    // APIステータスを更新
    await generatedApiOperations.update(apiId, { status: "active" });

    return c.json({
      success: true,
      data: deployResult.data,
    });
  } catch (_error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE /deploy/:id - APIの無効化
generatorRoutes.delete("/deploy/:id", async (c) => {
  try {
    const apiId = c.req.param("id");
    const user = c.get("user");

    // 権限チェック
    const database = await getDatabaseConnection();
    const generatedApiOperations = new GeneratedApiOperations(database);
    const apiResult = await generatedApiOperations.findById(apiId);

    if (!apiResult.success || !apiResult.data) {
      return c.json({ error: "API not found" }, 404);
    }

    if (apiResult.data.userId !== user.userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    // 動的デプロイメントを無効化
    const deploymentService = getDynamicDeploymentService();
    const undeployResult = await deploymentService.undeployApi(
      user.userId,
      apiId,
    );

    if (!undeployResult.success) {
      return c.json({ error: undeployResult.error }, 500);
    }

    // APIステータスを更新
    await generatedApiOperations.update(apiId, { status: "inactive" });

    return c.json({
      success: true,
      data: undeployResult.data,
    });
  } catch (_error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /deployments - デプロイメント一覧
generatorRoutes.get("/deployments", async (c) => {
  try {
    const user = c.get("user");

    const deploymentService = getDynamicDeploymentService();
    const deploymentsResult = await deploymentService.listDeployments(
      user.userId,
    );

    if (!deploymentsResult.success) {
      return c.json({ error: deploymentsResult.error }, 500);
    }

    return c.json({
      success: true,
      data: deploymentsResult.data,
    });
  } catch (_error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /list - ユーザーのAPI一覧
generatorRoutes.get("/list", async (c) => {
  try {
    const user = c.get("user");
    const database = await getDatabaseConnection();
    const generatedApiOperations = new GeneratedApiOperations(database);

    const result = await generatedApiOperations.findByUser(user.userId);
    if (!result.success) {
      return c.json({ error: "Failed to fetch APIs" }, 500);
    }

    return c.json({
      success: true,
      data: result.data,
    });
  } catch (_error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /:id - API詳細取得
generatorRoutes.get("/:id", async (c) => {
  try {
    const apiId = c.req.param("id");
    const user = c.get("user");
    const database = await getDatabaseConnection();
    const generatedApiOperations = new GeneratedApiOperations(database);

    const result = await generatedApiOperations.findById(apiId);
    if (!result.success) {
      return c.json({ error: "Database error" }, 500);
    }

    if (!result.data) {
      return c.json({ error: "API not found" }, 404);
    }

    // アクセス権限チェック
    if (result.data.userId !== user.userId) {
      return c.json({ error: "Access denied" }, 403);
    }

    return c.json({
      success: true,
      data: result.data,
    });
  } catch (_error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE /:id - API削除
generatorRoutes.delete("/:id", async (c) => {
  try {
    const apiId = c.req.param("id");
    const user = c.get("user");
    const database = await getDatabaseConnection();
    const generatedApiOperations = new GeneratedApiOperations(database);

    // 存在確認とアクセス権限チェック
    const findResult = await generatedApiOperations.findById(apiId);
    if (!findResult.success) {
      return c.json({ error: "Database error" }, 500);
    }

    if (!findResult.data) {
      return c.json({ error: "API not found" }, 404);
    }

    if (findResult.data.userId !== user.userId) {
      return c.json({ error: "Access denied" }, 403);
    }

    // 削除実行
    const deleteResult = await generatedApiOperations.delete(apiId);
    if (!deleteResult.success) {
      return c.json({ error: "Failed to delete API" }, 500);
    }

    return c.json({
      success: true,
      message: "API deleted successfully",
    });
  } catch (_error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { generatorRoutes };
