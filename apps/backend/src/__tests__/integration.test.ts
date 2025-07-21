import { beforeEach, describe, expect, it } from "vitest";
import app from "../index";
import { JwtUtils } from "../utils/jwt";

describe("アプリケーション統合テスト - JWT認証", () => {
  let jwtUtils: JwtUtils;
  let validToken: string;
  const secretKey = process.env.JWT_SECRET || "development-jwt-secret-key";

  const mockPayload = {
    userId: "123e4567-e89b-12d3-a456-426614174000",
    email: "test@example.com",
    organizationId: "987e6543-e21b-34d5-a678-426614174999",
  };

  beforeEach(async () => {
    jwtUtils = new JwtUtils(secretKey);
    validToken = await jwtUtils.sign(mockPayload);
  });

  describe("無料エンドポイント", () => {
    it("ルートエンドポイントにアクセスできる", async () => {
      const res = await app.request("/");

      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        message: string;
        endpoints: { authenticated: string[] };
      };
      expect(data.message).toBe("x402 Learning Lab API");
      expect(data.endpoints.authenticated).toContain("/auth/profile");
      expect(data.endpoints.authenticated).toContain("/internal/user/stats");
    });
  });

  describe("JWT認証エンドポイント", () => {
    it("/auth/profile に認証なしでアクセスすると401を返す", async () => {
      const res = await app.request("/auth/profile");

      expect(res.status).toBe(401);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe("Authorization header is required");
    });

    it("/auth/profile に有効なJWTでアクセスできる", async () => {
      const res = await app.request("/auth/profile", {
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        message: string;
        user: { id: string; email: string };
      };
      expect(data.message).toBe("User profile data");
      expect(data.user.id).toBe(mockPayload.userId);
      expect(data.user.email).toBe(mockPayload.email);
    });

    it("/internal/user/stats に認証なしでアクセスすると401を返す", async () => {
      const res = await app.request("/internal/user/stats");

      expect(res.status).toBe(401);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe("Authorization header is required");
    });

    it("/internal/user/stats に有効なJWTでアクセスできる", async () => {
      const res = await app.request("/internal/user/stats", {
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        message: string;
        userId: string;
        stats: object;
      };
      expect(data.message).toBe("Internal user statistics");
      expect(data.userId).toBe(mockPayload.userId);
      expect(data.stats).toBeDefined();
    });

    it("無効なJWTで認証エンドポイントにアクセスすると401を返す", async () => {
      const res = await app.request("/auth/profile", {
        headers: {
          Authorization: "Bearer invalid.jwt.token",
        },
      });

      expect(res.status).toBe(401);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe("Invalid or expired token");
    });
  });

  describe("x402決済エンドポイント（既存機能確認）", () => {
    it("/protected/demo は引き続きx402決済が必要", async () => {
      const res = await app.request("/protected/demo");

      // x402決済が必要なため402ステータス
      expect(res.status).toBe(402);
    });

    it("/protected/weather は引き続きx402決済が必要", async () => {
      const res = await app.request("/protected/weather");

      // x402決済が必要なため402ステータス
      expect(res.status).toBe(402);
    });
  });
});
