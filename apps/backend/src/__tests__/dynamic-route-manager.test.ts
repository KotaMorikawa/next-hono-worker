import { beforeEach, describe, expect, it, vi } from "vitest";
import { DynamicRouteManager } from "../services/dynamic-route-manager";
import type { DynamicRouteEntry } from "../types/dynamic-routes";

// Cloudflare Workers環境をモック化
vi.mock("../utils/workers-env", async (_importOriginal) => {
  return {
    getKVNamespace: () => ({
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    }),
    KVKeys: {
      dynamicRoute: (userId: string, apiId: string, version: number) =>
        `api:${userId}:${apiId}:${version}`,
      userRoutes: (userId: string) => `api:${userId}:`,
      routeMetadata: (userId: string, apiId: string) =>
        `meta:${userId}:${apiId}`,
    },
    KVHelper: class MockKVHelper {
      private kv: KVNamespace;

      constructor(kv?: KVNamespace) {
        this.kv = kv || {
          get: vi.fn(),
          put: vi.fn(),
          delete: vi.fn(),
          list: vi.fn(),
        } as unknown as KVNamespace;
      }

      async get<T = unknown>(key: string): Promise<T | null> {
        try {
          const value = await this.kv.get(key);
          return value ? JSON.parse(value) : null;
        } catch {
          return null;
        }
      }

      async put<T = unknown>(
        key: string,
        value: T,
        options?: { expirationTtl?: number; metadata?: Record<string, unknown> },
      ): Promise<boolean> {
        try {
          const serialized = JSON.stringify(value);
          await this.kv.put(key, serialized, options);
          return true;
        } catch {
          return false;
        }
      }

      async delete(key: string): Promise<boolean> {
        try {
          await this.kv.delete(key);
          return true;
        } catch {
          return false;
        }
      }

      async list(options?: { prefix?: string; limit?: number }): Promise<string[]> {
        try {
          const result = await this.kv.list(options);
          return result.keys?.map((key: { name: string }) => key.name) || [];
        } catch {
          return [];
        }
      }
    },
  };
});

// Workers KVをモック化（グローバルモック用）

describe("DynamicRouteManager", () => {
  let routeManager: DynamicRouteManager;
  let mockKVNamespace: KVNamespace;

  beforeEach(() => {
    vi.clearAllMocks();

    // KVNamespaceのモックを作成
    mockKVNamespace = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    } as unknown as KVNamespace;

    routeManager = new DynamicRouteManager(mockKVNamespace);
  });

  describe("saveRoute", () => {
    it("新しいAPIルートをKVに保存できる", async () => {
      // Arrange
      const routeEntry: DynamicRouteEntry = {
        code: `import { Hono } from 'hono'
const app = new Hono()
app.get('/api/test', (c) => c.json({ message: 'test' }))
export default app`,
        metadata: {
          endpoint: "/api/test",
          method: "GET",
          status: "active",
          createdAt: new Date().toISOString(),
          version: 1,
          userId: "user-123",
          apiId: "api-456",
        },
      };

      vi.mocked(mockKVNamespace.put).mockResolvedValue(undefined);

      // Act
      const result = await routeManager.saveRoute(routeEntry);

      // Assert
      expect(result.success).toBe(true);
      expect(mockKVNamespace.put).toHaveBeenCalledWith(
        "api:user-123:api-456:1",
        JSON.stringify(routeEntry),
        { expirationTtl: 86400 * 30 }, // 30日間有効
      );
    });

    it("無効なコードでバリデーションエラーを返す", async () => {
      // Arrange
      const invalidRouteEntry: DynamicRouteEntry = {
        code: 'eval("malicious code")', // 危険なコード
        metadata: {
          endpoint: "/api/test",
          method: "GET",
          status: "active",
          createdAt: new Date().toISOString(),
          version: 1,
          userId: "user-123",
          apiId: "api-456",
        },
      };

      // Act
      const result = await routeManager.saveRoute(invalidRouteEntry);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid code detected");
      expect(mockKVNamespace.put).not.toHaveBeenCalled();
    });
  });

  describe("loadRoute", () => {
    it("指定されたAPIルートをKVから読み込める", async () => {
      // Arrange
      const routeEntry: DynamicRouteEntry = {
        code: `import { Hono } from 'hono'
const app = new Hono()
app.get('/api/test', (c) => c.json({ message: 'test' }))
export default app`,
        metadata: {
          endpoint: "/api/test",
          method: "GET",
          status: "active",
          createdAt: new Date().toISOString(),
          version: 1,
          userId: "user-123",
          apiId: "api-456",
        },
      };

      vi.mocked(mockKVNamespace.get).mockResolvedValue(
        JSON.stringify(routeEntry) as unknown as ReadableStream<unknown> | null,
      );

      // Act
      const result = await routeManager.loadRoute("user-123", "api-456", 1);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(routeEntry);
      expect(mockKVNamespace.get).toHaveBeenCalledWith(
        "api:user-123:api-456:1",
      );
    });

    it("存在しないルートで null を返す", async () => {
      // Arrange
      vi.mocked(mockKVNamespace.get).mockResolvedValue(null);

      // Act
      const result = await routeManager.loadRoute(
        "user-123",
        "nonexistent-api",
        1,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBe(null);
    });
  });

  describe("listUserRoutes", () => {
    it("ユーザーのすべてのルートを一覧表示できる", async () => {
      // Arrange
      const mockKeys = [
        { name: "api:user-123:api-1:1" },
        { name: "api:user-123:api-1:2" },
        { name: "api:user-123:api-2:1" },
      ];

      const mockRouteEntries = [
        {
          code: "test code 1",
          metadata: {
            endpoint: "/api/test1",
            method: "GET",
            status: "active",
            createdAt: new Date().toISOString(),
            version: 1,
            userId: "user-123",
            apiId: "api-1",
          },
        },
        {
          code: "test code 2",
          metadata: {
            endpoint: "/api/test1-v2",
            method: "GET", 
            status: "active",
            createdAt: new Date().toISOString(),
            version: 2,
            userId: "user-123",
            apiId: "api-1",
          },
        },
        {
          code: "test code 3",
          metadata: {
            endpoint: "/api/test2",
            method: "POST",
            status: "active",
            createdAt: new Date().toISOString(),
            version: 1,
            userId: "user-123",
            apiId: "api-2",
          },
        },
      ];

      vi.mocked(mockKVNamespace.list).mockResolvedValue({
        keys: mockKeys,
        list_complete: true,
      });

      // Setup individual get mocks for each key
      vi.mocked(mockKVNamespace.get)
        .mockResolvedValueOnce(JSON.stringify(mockRouteEntries[0]) as unknown as ReadableStream<unknown> | null)
        .mockResolvedValueOnce(JSON.stringify(mockRouteEntries[1]) as unknown as ReadableStream<unknown> | null)
        .mockResolvedValueOnce(JSON.stringify(mockRouteEntries[2]) as unknown as ReadableStream<unknown> | null);

      // Act
      const result = await routeManager.listUserRoutes("user-123");

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(mockKVNamespace.list).toHaveBeenCalledWith({
        prefix: "api:user-123:",
      });
    });
  });

  describe("rollbackRoute", () => {
    it("指定されたバージョンにロールバックできる", async () => {
      // Arrange
      const targetRoute: DynamicRouteEntry = {
        code: `import { Hono } from 'hono'
const app = new Hono()
app.get('/api/test', (c) => c.json({ message: 'rollback version' }))
export default app`,
        metadata: {
          endpoint: "/api/test",
          method: "GET",
          status: "active",
          createdAt: new Date().toISOString(),
          version: 1,
          userId: "user-123",
          apiId: "api-456",
        },
      };

      // Setup mocks for listUserRoutes (used by getLatestVersion)
      const mockKeys = [
        { name: "api:user-123:api-456:1" },
        { name: "api:user-123:api-456:2" },
      ];

      const existingRoutes = [
        {
          code: `import { Hono } from 'hono'
const app = new Hono()
app.get('/api/test', (c) => c.json({ message: 'v1' }))
export default app`,
          metadata: {
            endpoint: "/api/test",
            method: "GET",
            status: "active",
            createdAt: new Date().toISOString(),
            version: 1,
            userId: "user-123",
            apiId: "api-456",
          },
        },
        {
          code: `import { Hono } from 'hono'
const app = new Hono()
app.get('/api/test', (c) => c.json({ message: 'v2' }))
export default app`,
          metadata: {
            endpoint: "/api/test",
            method: "GET",
            status: "active",
            createdAt: new Date().toISOString(),
            version: 2,
            userId: "user-123",
            apiId: "api-456",
          },
        },
      ];

      vi.mocked(mockKVNamespace.list).mockResolvedValue({
        keys: mockKeys,
        list_complete: true,
      });

      // Mock specific get calls based on key
      vi.mocked(mockKVNamespace.get).mockImplementation((key: string) => {
        if (key === "api:user-123:api-456:1") {
          return Promise.resolve(JSON.stringify(existingRoutes[0]) as unknown as ReadableStream<unknown> | null);
        }
        if (key === "api:user-123:api-456:2") {
          return Promise.resolve(JSON.stringify(existingRoutes[1]) as unknown as ReadableStream<unknown> | null);
        }
        return Promise.resolve(null);
      });

      vi.mocked(mockKVNamespace.put).mockResolvedValue(undefined);

      // Act
      const result = await routeManager.rollbackRoute("user-123", "api-456", 1);

      // Assert
      expect(result.success).toBe(true);
      expect(mockKVNamespace.get).toHaveBeenCalledWith(
        "api:user-123:api-456:1",
      );
      expect(mockKVNamespace.put).toHaveBeenCalled();
      // Check if the result data contains the expected rollback code (from version 1)
      expect(result.data?.code).toBe(existingRoutes[0].code);
      // Also verify the rollback preserves the target route's endpoint structure
      expect(result.data?.metadata.endpoint).toBe(targetRoute.metadata.endpoint);
    });
  });

  describe("deleteRoute", () => {
    it("指定されたルートを削除できる", async () => {
      // Arrange
      vi.mocked(mockKVNamespace.delete).mockResolvedValue(undefined);

      // Act
      const result = await routeManager.deleteRoute("user-123", "api-456", 1);

      // Assert
      expect(result.success).toBe(true);
      expect(mockKVNamespace.delete).toHaveBeenCalledWith(
        "api:user-123:api-456:1",
      );
    });
  });
});
