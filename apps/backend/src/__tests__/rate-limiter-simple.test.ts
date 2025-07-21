import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RateLimitConfig } from "../types/monitoring";
import { RateLimiter } from "../utils/rate-limiter";

type MockKV = {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
};

// シンプルなテスト - RateLimiterの動作確認
describe("Rate Limiter Simple Test", () => {
  let mockKV: MockKV;
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    const store = new Map<string, { value: string }>();

    mockKV = {
      get: vi.fn(async (key: string) => {
        const item = store.get(key);
        return item?.value || null;
      }),
      put: vi.fn(async (key: string, value: string) => {
        store.set(key, { value });
      }),
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
    };

    rateLimiter = RateLimiter.initialize(mockKV);
  });

  it("基本的なレート制限が動作する", async () => {
    const config: RateLimitConfig = {
      windowMs: 60000,
      maxRequests: 2,
      headers: true,
    };

    // 1回目 - 許可される
    const result1 = await rateLimiter.checkRateLimit("test-key", config);
    expect(result1.allowed).toBe(true);
    expect(result1.current).toBe(1);
    expect(result1.remaining).toBe(1);

    // 2回目 - 許可される
    const result2 = await rateLimiter.checkRateLimit("test-key", config);
    expect(result2.allowed).toBe(true);
    expect(result2.current).toBe(2);
    expect(result2.remaining).toBe(0);

    // 3回目 - 拒否される
    const result3 = await rateLimiter.checkRateLimit("test-key", config);
    expect(result3.allowed).toBe(false);
    expect(result3.current).toBe(2);
    expect(result3.remaining).toBe(0);
    expect(result3.retryAfter).toBeGreaterThan(0);
  });

  it("複数のレート制限ルールをチェックする", async () => {
    const options = {
      perIP: {
        windowMs: 60000,
        maxRequests: 1,
        headers: true,
      },
    };

    const req = {
      ip: "192.168.1.1",
      endpoint: "/test",
      method: "GET",
    };

    // 1回目 - 許可される
    const result1 = await rateLimiter.checkMultipleRateLimits(req, options);
    expect(result1.allowed).toBe(true);
    expect(result1.rule).toBe("per-ip");

    // 2回目 - 拒否される
    const result2 = await rateLimiter.checkMultipleRateLimits(req, options);
    expect(result2.allowed).toBe(false);
    expect(result2.rule).toBe("per-ip");
  });

  it("レート制限情報を取得できる", async () => {
    const config: RateLimitConfig = {
      windowMs: 60000,
      maxRequests: 5,
      headers: true,
    };

    // リクエストを実行
    await rateLimiter.checkRateLimit("test-key", config);
    await rateLimiter.checkRateLimit("test-key", config);

    // 統計を取得
    const stats = await rateLimiter.getRateLimitStats();
    expect(stats.length).toBeGreaterThan(0);
  });
});
