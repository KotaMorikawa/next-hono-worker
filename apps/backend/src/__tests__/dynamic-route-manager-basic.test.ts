import { describe, expect, it, vi } from "vitest";

// 基本的なDynamicRouteManagerテスト
describe("DynamicRouteManager - 基本テスト", () => {
  it("DynamicRouteManagerクラスがインスタンス化できる", async () => {
    // モック設定を避けて、実際のクラスの構造をテスト
    const { DynamicRouteManager } = await import(
      "../services/dynamic-route-manager"
    );

    // KVNamespaceをモック
    const mockKV = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ keys: [] }),
    } as unknown as KVNamespace;

    const manager = new DynamicRouteManager(mockKV);
    expect(manager).toBeDefined();
    expect(typeof manager.saveRoute).toBe("function");
    expect(typeof manager.loadRoute).toBe("function");
  });

  it("コードバリデーションが基本的に動作する", async () => {
    const { DynamicRouteManager } = await import(
      "../services/dynamic-route-manager"
    );

    const mockKV = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ keys: [] }),
    } as unknown as KVNamespace;

    const manager = new DynamicRouteManager(mockKV);

    // 無効なコードでテスト
    const invalidRoute = {
      code: 'eval("malicious")',
      metadata: {
        endpoint: "/test",
        method: "GET",
        status: "draft" as const,
        createdAt: new Date().toISOString(),
        version: 1,
        userId: "test-user",
        apiId: "test-api",
      },
    };

    const result = await manager.saveRoute(invalidRoute);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
