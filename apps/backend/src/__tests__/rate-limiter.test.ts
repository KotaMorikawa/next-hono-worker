import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RateLimitConfig } from "../types/monitoring";
import { RateLimiter } from "../utils/rate-limiter";

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
    // デバッグ用: ストアの状態を確認
    _getStore: () => store,
    _clear: () => store.clear(),
  };
};

describe("RateLimiter", () => {
  let rateLimiter: RateLimiter;
  let mockKV: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    mockKV = createMockKV();
    rateLimiter = RateLimiter.initialize(mockKV as unknown as KVNamespace);
    vi.clearAllMocks();
  });

  describe("checkRateLimit", () => {
    const config: RateLimitConfig = {
      windowMs: 60000, // 1分
      maxRequests: 5, // 5リクエスト
      headers: true,
    };

    it("初回リクエストを許可する", async () => {
      const result = await rateLimiter.checkRateLimit("test-key", config);

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1);
      expect(result.remaining).toBe(4);
      expect(mockKV.put).toHaveBeenCalledWith(
        "ratelimit:test-key",
        expect.stringContaining('"count":1'),
        { expirationTtl: 60 },
      );
    });

    it("制限内の複数リクエストを許可する", async () => {
      // 1回目
      const result1 = await rateLimiter.checkRateLimit("test-key", config);
      expect(result1.allowed).toBe(true);
      expect(result1.current).toBe(1);
      expect(result1.remaining).toBe(4);

      // 2回目
      const result2 = await rateLimiter.checkRateLimit("test-key", config);
      expect(result2.allowed).toBe(true);
      expect(result2.current).toBe(2);
      expect(result2.remaining).toBe(3);

      // 3回目
      const result3 = await rateLimiter.checkRateLimit("test-key", config);
      expect(result3.allowed).toBe(true);
      expect(result3.current).toBe(3);
      expect(result3.remaining).toBe(2);
    });

    it("制限を超えたリクエストを拒否する", async () => {
      // 制限まで実行
      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.checkRateLimit("test-key", config);
        expect(result.allowed).toBe(true);
      }

      // 制限を超える
      const result = await rateLimiter.checkRateLimit("test-key", config);
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(5);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it("異なるキーは独立してカウントされる", async () => {
      // key1で制限まで実行
      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.checkRateLimit("key1", config);
        expect(result.allowed).toBe(true);
      }

      // key1は制限に達している
      const result1 = await rateLimiter.checkRateLimit("key1", config);
      expect(result1.allowed).toBe(false);

      // key2はまだ制限に達していない
      const result2 = await rateLimiter.checkRateLimit("key2", config);
      expect(result2.allowed).toBe(true);
      expect(result2.current).toBe(1);
    });

    it("KVが利用できない場合は制限なしとする", async () => {
      const rateLimiterNoKV = RateLimiter.initialize();

      const result = await rateLimiterNoKV.checkRateLimit("test-key", config);

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(0);
      expect(result.remaining).toBe(5);
    });
  });

  describe("checkMultipleRateLimits", () => {
    it("複数のルールをチェックして最初の制限に達したものを返す", async () => {
      const options = {
        global: {
          windowMs: 60000,
          maxRequests: 10,
          headers: true,
        },
        perIP: {
          windowMs: 60000,
          maxRequests: 2, // より厳しい制限
          headers: true,
        },
      };

      const req = {
        ip: "192.168.1.1",
        endpoint: "/api/test",
        method: "GET",
      };

      // 1回目
      const result1 = await rateLimiter.checkMultipleRateLimits(req, options);
      expect(result1.allowed).toBe(true);

      // 2回目
      const result2 = await rateLimiter.checkMultipleRateLimits(req, options);
      expect(result2.allowed).toBe(true);

      // 3回目 - IP制限に達する
      const result3 = await rateLimiter.checkMultipleRateLimits(req, options);
      expect(result3.allowed).toBe(false);
      expect(result3.rule).toBe("per-ip");
    });

    it("ユーザー別制限をチェックする", async () => {
      const options = {
        perUser: {
          windowMs: 60000,
          maxRequests: 3,
          headers: true,
        },
      };

      const req = {
        userId: "user123",
        endpoint: "/api/test",
        method: "GET",
      };

      // 制限まで実行
      for (let i = 0; i < 3; i++) {
        const result = await rateLimiter.checkMultipleRateLimits(req, options);
        expect(result.allowed).toBe(true);
      }

      // 制限を超える
      const result = await rateLimiter.checkMultipleRateLimits(req, options);
      expect(result.allowed).toBe(false);
      expect(result.rule).toBe("per-user");
    });

    it("エンドポイント別制限をチェックする", async () => {
      const options = {
        perEndpoint: {
          "POST /api/generate": {
            windowMs: 60000,
            maxRequests: 1, // 非常に厳しい制限
            headers: true,
          },
        },
      };

      const req = {
        ip: "192.168.1.1",
        endpoint: "/api/generate",
        method: "POST",
      };

      // 1回目は許可
      const result1 = await rateLimiter.checkMultipleRateLimits(req, options);
      expect(result1.allowed).toBe(true);

      // 2回目は拒否
      const result2 = await rateLimiter.checkMultipleRateLimits(req, options);
      expect(result2.allowed).toBe(false);
      expect(result2.rule).toBe("endpoint:POST /api/generate");
    });
  });

  describe("resetRateLimit", () => {
    it("指定されたキーのレート制限をリセットする", async () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 2,
        headers: true,
      };

      // 制限まで実行
      await rateLimiter.checkRateLimit("test-key", config);
      await rateLimiter.checkRateLimit("test-key", config);

      // 制限に達していることを確認
      const result1 = await rateLimiter.checkRateLimit("test-key", config);
      expect(result1.allowed).toBe(false);

      // リセット
      await rateLimiter.resetRateLimit("test-key");

      // リセット後は再び許可される
      const result2 = await rateLimiter.checkRateLimit("test-key", config);
      expect(result2.allowed).toBe(true);
      expect(result2.current).toBe(1);
    });
  });

  describe("getRateLimitStats", () => {
    it("レート制限統計を取得する", async () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 5,
        headers: true,
      };

      // いくつかのキーでリクエスト
      await rateLimiter.checkRateLimit("key1", config);
      await rateLimiter.checkRateLimit("key1", config);
      await rateLimiter.checkRateLimit("key2", config);

      const stats = await rateLimiter.getRateLimitStats();

      expect(stats).toHaveLength(2);
      expect(stats.find((s) => s.key === "key1")?.entry.count).toBe(2);
      expect(stats.find((s) => s.key === "key2")?.entry.count).toBe(1);
    });

    it("パターンでフィルタリングできる", async () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 5,
        headers: true,
      };

      await rateLimiter.checkRateLimit("user:123", config);
      await rateLimiter.checkRateLimit("ip:192.168.1.1", config);

      const userStats = await rateLimiter.getRateLimitStats("user:");
      expect(userStats).toHaveLength(1);
      expect(userStats[0].key).toBe("user:123");
    });
  });
});
