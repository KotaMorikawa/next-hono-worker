import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationError } from "../middleware/error-handler";
import {
  endpointRateLimit,
  rateLimitMiddleware,
  strictRateLimit,
} from "../middleware/rate-limiter";
import type { RateLimitOptions } from "../types/monitoring";
import { rateLimiter } from "../utils/rate-limiter";

// KVNamespace のモック
const createMockKV = () => {
  const store = new Map<string, { value: string; expiration?: number }>();

  return {
    get: vi.fn(async (key: string) => {
      const item = store.get(key);
      if (item && (!item.expiration || Date.now() < item.expiration)) {
        return item.value;
      }
      return null;
    }),
    put: vi.fn(
      async (
        key: string,
        value: string,
        options?: { expirationTtl?: number },
      ) => {
        const expiration = options?.expirationTtl
          ? Date.now() + options.expirationTtl * 1000
          : undefined;
        store.set(key, { value, expiration });
      },
    ),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async (options: { prefix?: string; limit?: number }) => {
      const keys = Array.from(store.keys())
        .filter((key) => !options.prefix || key.startsWith(options.prefix))
        .slice(0, options.limit || 1000)
        .map((name) => ({ name }));
      return { keys };
    }),
    // デバッグ用
    _clear: () => store.clear(),
  };
};

describe("Rate Limiter Integration", () => {
  let app: Hono;
  let mockKV: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    app = new Hono();
    mockKV = createMockKV();

    // シングルトンrateLimiterのKVを更新（テスト用）
    rateLimiter.updateKVNamespace(mockKV as unknown as KVNamespace);

    // Honoのエラーハンドラーを使用
    app.onError((err, c) => {
      console.log("HONO ERROR HANDLER:", {
        error: err instanceof Error ? err.constructor.name : typeof err,
        message: err instanceof Error ? err.message : String(err),
        isApplicationError: err instanceof ApplicationError,
        statusCode: err instanceof ApplicationError ? err.statusCode : 500,
      });

      if (err instanceof ApplicationError) {
        return c.json(
          {
            success: false,
            error: {
              code: err.code,
              message: err.message,
            },
          },
          err.statusCode as 429,
        );
      }

      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "An error occurred",
          },
        },
        500 as 500,
      );
    });

    vi.clearAllMocks();
  });

  describe("rateLimitMiddleware", () => {
    it("制限内のリクエストを通す", async () => {
      const options: RateLimitOptions = {
        global: undefined, // デフォルトのグローバル設定を無効化
        perIP: {
          windowMs: 60000,
          maxRequests: 2,
          headers: true,
        },
      };

      app.use("*", rateLimitMiddleware(options));
      app.get("/test", (c) => c.json({ message: "success" }));

      // 1回目
      const res1 = await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.1" },
      });
      expect(res1.status).toBe(200);
      expect(res1.headers.get("X-RateLimit-Limit")).toBe("2");
      expect(res1.headers.get("X-RateLimit-Remaining")).toBe("1");

      // 2回目
      const res2 = await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.1" },
      });
      expect(res2.status).toBe(200);
      expect(res2.headers.get("X-RateLimit-Limit")).toBe("2");
      expect(res2.headers.get("X-RateLimit-Remaining")).toBe("0");
    });

    it("制限を超えたリクエストを拒否する", async () => {
      const options: RateLimitOptions = {
        global: undefined, // デフォルトのグローバル設定を無効化
        perIP: {
          windowMs: 60000,
          maxRequests: 1,
          headers: true,
          message: "Too many requests",
        },
      };

      app.use("*", rateLimitMiddleware(options));
      app.get("/test", (c) => c.json({ message: "success" }));

      // 1回目は通る
      const res1 = await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.1" },
      });
      expect(res1.status).toBe(200);

      // 2回目は拒否される
      const res2 = await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.1" },
      });
      expect(res2.status).toBe(429);
      expect(res2.headers.get("Retry-After")).toBeTruthy();

      const body = (await res2.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED");
    });

    it("異なるIPは独立して制限される", async () => {
      const options: RateLimitOptions = {
        global: undefined, // デフォルトのグローバル設定を無効化
        perIP: {
          windowMs: 60000,
          maxRequests: 1,
          headers: true,
        },
      };

      app.use("*", rateLimitMiddleware(options));
      app.get("/test", (c) => c.json({ message: "success" }));

      // IP1で制限まで
      const res1 = await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.1" },
      });
      expect(res1.status).toBe(200);

      const res2 = await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.1" },
      });
      expect(res2.status).toBe(429);

      // 異なるIPは制限されない
      const res3 = await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.2" },
      });
      expect(res3.status).toBe(200);
    });

    it("エンドポイント別制限が適用される", async () => {
      const options: RateLimitOptions = {
        global: undefined, // デフォルトのグローバル設定を無効化
        perEndpoint: {
          "POST /api/generate": {
            windowMs: 60000,
            maxRequests: 1,
            headers: true,
            message: "API generation limit exceeded",
          },
          "GET /api/list": {
            windowMs: 60000,
            maxRequests: 5,
            headers: true,
          },
        },
      };

      app.use("*", rateLimitMiddleware(options));
      app.post("/api/generate", (c) => c.json({ message: "generated" }));
      app.get("/api/list", (c) => c.json({ message: "list" }));

      const headers = { "X-Forwarded-For": "192.168.1.1" };

      // /api/generate は厳しく制限される
      const res1 = await app.request("/api/generate", {
        method: "POST",
        headers,
      });
      expect(res1.status).toBe(200);

      const res2 = await app.request("/api/generate", {
        method: "POST",
        headers,
      });
      expect(res2.status).toBe(429);
      const body2 = await res2.json() as { success: boolean; error: { code: string; message: string } };
      expect(body2.error.message).toContain("API generation limit exceeded");

      // /api/list はより緩い制限
      for (let i = 0; i < 5; i++) {
        const res = await app.request("/api/list", { headers });
        expect(res.status).toBe(200);
      }

      // 6回目で制限される
      const res6 = await app.request("/api/list", { headers });
      expect(res6.status).toBe(429);
    });
  });

  describe("endpointRateLimit", () => {
    it("特定のエンドポイントに制限を適用する", async () => {
      app.use(
        "/api/special",
        endpointRateLimit(60000, 1, "Special endpoint limit"),
      );
      app.get("/api/special", (c) => c.json({ message: "special" }));
      app.get("/api/normal", (c) => c.json({ message: "normal" }));

      const headers = { "X-Forwarded-For": "192.168.1.1" };

      // /api/special は制限される
      const res1 = await app.request("/api/special", { headers });
      expect(res1.status).toBe(200);

      const res2 = await app.request("/api/special", { headers });
      expect(res2.status).toBe(429);

      // /api/normal は制限されない
      const res3 = await app.request("/api/normal", { headers });
      expect(res3.status).toBe(200);
    });
  });

  describe("strictRateLimit", () => {
    it("厳しい制限を適用する", async () => {
      app.use("/admin/*", strictRateLimit());
      app.get("/admin/settings", (c) => c.json({ message: "admin" }));

      const headers = { "X-Forwarded-For": "192.168.1.1" };

      // 制限回数まで実行
      for (let i = 0; i < 5; i++) {
        const res = await app.request("/admin/settings", { headers });
        expect(res.status).toBe(200);
      }

      // 制限を超える
      const res = await app.request("/admin/settings", { headers });
      expect(res.status).toBe(429);

      const body = await res.json() as { success: boolean; error: { code: string; message: string } };
      expect(body.error.message).toContain("Strict rate limit exceeded");
    });
  });

  describe("headers", () => {
    it("適切なレート制限ヘッダーを設定する", async () => {
      const options: RateLimitOptions = {
        global: undefined, // デフォルトのグローバル設定を無効化
        perIP: {
          windowMs: 60000,
          maxRequests: 3,
          headers: true,
        },
      };

      app.use("*", rateLimitMiddleware(options));
      app.get("/test", (c) => c.json({ message: "success" }));

      const res = await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.1" },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("X-RateLimit-Limit")).toBe("3");
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("2");
      expect(res.headers.get("X-RateLimit-Reset")).toBeTruthy();
    });

    it("headers: false の場合はヘッダーを含めない", async () => {
      const options: RateLimitOptions = {
        global: undefined, // デフォルトのグローバル設定を無効化
        perIP: {
          windowMs: 60000,
          maxRequests: 3,
          headers: false,
        },
      };

      app.use("*", rateLimitMiddleware(options));
      app.get("/test", (c) => c.json({ message: "success" }));

      const res = await app.request("/test", {
        headers: { "X-Forwarded-For": "192.168.1.1" },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("X-RateLimit-Limit")).toBeNull();
      expect(res.headers.get("X-RateLimit-Remaining")).toBeNull();
      expect(res.headers.get("X-RateLimit-Reset")).toBeNull();
    });
  });
});
