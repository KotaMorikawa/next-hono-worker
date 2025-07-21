import type { Database } from "@repo/db";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

// グローバルモック設定
vi.mock("@repo/db", () => {
  const mockOperations = {
    create: vi.fn(),
    findByUser: vi.fn(),
    findById: vi.fn(),
    delete: vi.fn(),
  };

  return {
    createClient: vi.fn().mockResolvedValue({
      db: {},
      sql: {},
      poolManager: {},
      healthChecker: {},
    }),
    GeneratedApiOperations: vi.fn(() => mockOperations),
  };
});

vi.mock("../services/llm-service", () => ({
  LLMService: vi.fn().mockImplementation(() => ({
    generateApiFromNaturalLanguage: vi.fn().mockResolvedValue({
      success: true,
      data: {
        name: "Mock Weather API",
        description: "Generated weather API",
        endpoint: "/api/weather",
        method: "GET",
        price: "0.01",
        generatedCode:
          'export default function handler() { return { weather: "sunny" } }',
        documentation: "# Weather API\nReturns current weather",
      },
    }),
  })),
}));

describe("API生成エンドポイント（修正版）", () => {
  let app: Hono;

  beforeEach(async () => {
    const { generatorRoutes } = await import("../routes/generator");

    app = new Hono();

    // 認証済みユーザーとしてテスト
    app.use("*", (c, next) => {
      c.set("user", {
        userId: "123e4567-e89b-12d3-a456-426614174000",
        email: "test@example.com",
        organizationId: "987e6543-e21b-34d5-a678-426614174999",
        iat: Date.now(),
        exp: Date.now() + 3600000,
      });
      return next();
    });

    app.route("/internal/generator", generatorRoutes);
  });

  describe("POST /internal/generator/create", () => {
    it("有効な自然言語入力でAPI生成に成功する", async () => {
      // Arrange
      const { GeneratedApiOperations } = await import("@repo/db");
      const mockInstance = new GeneratedApiOperations({} as Database);

      const mockApiData = {
        id: "api-123",
        name: "Mock Weather API",
        description: "Generated weather API",
        endpoint: "/api/weather",
        method: "GET" as const,
        price: "0.01",
        currency: "USDC" as const,
        generatedCode:
          'export default function handler() { return { weather: "sunny" } }',
        documentation: "# Weather API\nReturns current weather",
        status: "draft" as const,
        userId: "123e4567-e89b-12d3-a456-426614174000",
        organizationId: "987e6543-e21b-34d5-a678-426614174999",
        testCode: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockInstance.create).mockResolvedValue({
        success: true,
        data: mockApiData,
      });

      const requestBody = {
        description: "天気情報を取得するAPIを作成してください",
        category: "data" as const,
        complexityLevel: "simple" as const,
      };

      // Act
      const res = await app.request("/internal/generator/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      // Assert
      expect(res.status).toBe(201);
      const data = (await res.json()) as {
        success: boolean;
        data: { api: typeof mockApiData; deployment: unknown };
      };
      expect(data.success).toBe(true);
      expect(data.data.api.name).toBe("Mock Weather API");
    });

    it("無効な入力でバリデーションエラーを返す", async () => {
      // Arrange
      const invalidRequestBody = {
        description: "short", // 10文字未満
        category: "invalid" as "data",
      };

      // Act
      const res = await app.request("/internal/generator/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidRequestBody),
      });

      // Assert
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string; details: unknown };
      expect(data.error).toBe("Validation failed");
      expect(data.details).toBeDefined();
    });
  });

  describe("GET /internal/generator/list", () => {
    it("認証ユーザーのAPI一覧を取得できる", async () => {
      // Arrange
      const { GeneratedApiOperations } = await import("@repo/db");
      const mockInstance = new GeneratedApiOperations({} as Database);

      const mockApis = [
        {
          id: "api-1",
          name: "Weather API",
          description: "Weather information API",
          endpoint: "/api/weather",
          method: "GET" as const,
          price: "0.01",
          currency: "USDC" as const,
          generatedCode: "mock code",
          testCode: null,
          documentation: "Weather API docs",
          status: "active" as const,
          userId: "123e4567-e89b-12d3-a456-426614174000",
          organizationId: "987e6543-e21b-34d5-a678-426614174999",
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockInstance.findByUser).mockResolvedValue({
        success: true,
        data: mockApis,
      });

      // Act
      const res = await app.request("/internal/generator/list");

      // Assert
      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        success: boolean;
        data: typeof mockApis;
      };
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].name).toBe("Weather API");
    });
  });

  describe("GET /internal/generator/:id", () => {
    it("有効なIDでAPI詳細を取得できる", async () => {
      // Arrange
      const { GeneratedApiOperations } = await import("@repo/db");
      const mockInstance = new GeneratedApiOperations({} as Database);

      const apiId = "api-123";
      const mockApi = {
        id: apiId,
        name: "Weather API",
        description: "Weather information API",
        endpoint: "/api/weather",
        method: "GET" as const,
        price: "0.01",
        currency: "USDC" as const,
        generatedCode:
          'export default function handler() { return { weather: "sunny" } }',
        testCode: null,
        documentation: "# Weather API\nReturns weather",
        status: "active" as const,
        userId: "123e4567-e89b-12d3-a456-426614174000",
        organizationId: "987e6543-e21b-34d5-a678-426614174999",
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockInstance.findById).mockResolvedValue({
        success: true,
        data: mockApi,
      });

      // Act
      const res = await app.request(`/internal/generator/${apiId}`);

      // Assert
      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        success: boolean;
        data: typeof mockApi;
      };
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(apiId);
      expect(data.data.name).toBe("Weather API");
    });

    it("存在しないIDで404を返す", async () => {
      // Arrange
      const { GeneratedApiOperations } = await import("@repo/db");
      const mockInstance = new GeneratedApiOperations({} as Database);

      const apiId = "nonexistent-api";
      vi.mocked(mockInstance.findById).mockResolvedValue({
        success: true,
        data: null,
      });

      // Act
      const res = await app.request(`/internal/generator/${apiId}`);

      // Assert
      expect(res.status).toBe(404);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe("API not found");
    });
  });

  describe("DELETE /internal/generator/:id", () => {
    it("有効なIDでAPI削除に成功する", async () => {
      // Arrange
      const { GeneratedApiOperations } = await import("@repo/db");
      const mockInstance = new GeneratedApiOperations({} as Database);

      const apiId = "api-123";
      const mockApi = {
        id: apiId,
        name: "Weather API",
        description: "Weather information API",
        endpoint: "/api/weather",
        method: "GET" as const,
        price: "0.01",
        currency: "USDC" as const,
        generatedCode: "mock code",
        testCode: null,
        documentation: "Weather API docs",
        status: "active" as const,
        userId: "123e4567-e89b-12d3-a456-426614174000",
        organizationId: "987e6543-e21b-34d5-a678-426614174999",
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockInstance.findById).mockResolvedValue({
        success: true,
        data: mockApi,
      });

      vi.mocked(mockInstance.delete).mockResolvedValue({
        success: true,
        data: true,
      });

      // Act
      const res = await app.request(`/internal/generator/${apiId}`, {
        method: "DELETE",
      });

      // Assert
      expect(res.status).toBe(200);
      const data = (await res.json()) as { success: boolean; message: string };
      expect(data.success).toBe(true);
      expect(data.message).toBe("API deleted successfully");
    });
  });
});
