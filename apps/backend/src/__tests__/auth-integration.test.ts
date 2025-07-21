import { describe, expect, it } from "vitest";
import app from "../index";

describe("認証API統合テスト - 実際のアプリケーション", () => {
  describe("エンドポイント存在確認", () => {
    it("ルートエンドポイントが認証エンドポイント情報を返す", async () => {
      const res = await app.request("/");

      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        endpoints: {
          auth: string[];
          authenticated: string[];
        };
      };

      expect(data.endpoints.auth).toContain("/internal/auth/register");
      expect(data.endpoints.auth).toContain("/internal/auth/login");
      expect(data.endpoints.authenticated).toContain("/internal/auth/profile");
    });
  });

  describe("認証不要エンドポイント", () => {
    it("POST /internal/auth/register が存在する", async () => {
      const res = await app.request("/internal/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      // 400または500でもエンドポイントは存在
      expect([400, 500].includes(res.status)).toBe(true);
    });

    it("POST /internal/auth/login が存在する", async () => {
      const res = await app.request("/internal/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      // 401でもエンドポイントは存在
      expect([401, 400, 500].includes(res.status)).toBe(true);
    });
  });

  describe("認証必須エンドポイント", () => {
    it("GET /internal/auth/profile は認証なしで401を返す", async () => {
      const res = await app.request("/internal/auth/profile");

      expect(res.status).toBe(401);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe("Authorization header is required");
    });

    it("PUT /internal/auth/profile は認証なしで401を返す", async () => {
      const res = await app.request("/internal/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      });

      expect(res.status).toBe(401);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe("Authorization header is required");
    });
  });

  describe("APIルーティング構造", () => {
    it("認証関連は /internal/auth/* で統一されている", async () => {
      const authEndpoints = [
        { method: "POST", path: "/internal/auth/register" },
        { method: "POST", path: "/internal/auth/login" },
        { method: "GET", path: "/internal/auth/profile" },
        { method: "PUT", path: "/internal/auth/profile" },
      ];

      for (const endpoint of authEndpoints) {
        const res = await app.request(endpoint.path, {
          method: endpoint.method,
          headers: { "Content-Type": "application/json" },
          body: endpoint.method !== "GET" ? JSON.stringify({}) : undefined,
        });

        // 404でないことを確認（エンドポイントが存在する）
        expect(res.status).not.toBe(404);
      }
    });

    it("x402決済エンドポイントは引き続き動作する", async () => {
      const res = await app.request("/protected/demo");

      // x402決済が必要なため402ステータス
      expect(res.status).toBe(402);
    });

    it("既存の認証済みエンドポイントは引き続き動作する", async () => {
      const res = await app.request("/auth/profile");

      // JWT認証が必要なため401ステータス
      expect(res.status).toBe(401);
    });
  });

  describe("エラーハンドリング", () => {
    it("存在しないエンドポイントで404を返す", async () => {
      const res = await app.request("/internal/auth/nonexistent");

      expect(res.status).toBe(404);
    });

    it("無効なJSONで適切なエラーを返す", async () => {
      const res = await app.request("/internal/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid-json",
      });

      expect([400, 500].includes(res.status)).toBe(true);
    });
  });
});
