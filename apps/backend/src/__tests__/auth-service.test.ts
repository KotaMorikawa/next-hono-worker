import type { Database } from "@repo/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "../services/auth-service";

// Mock types for test interfaces
interface MockUserOperations {
  findByEmail: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}

interface MockOrganizationOperations {
  create: ReturnType<typeof vi.fn>;
}

// Mock database operations
vi.mock("@repo/db", () => ({
  UserOperations: vi.fn(),
  OrganizationOperations: vi.fn(),
}));

// Mock password utilities
vi.mock("../utils/password", () => ({
  PasswordUtils: vi.fn().mockImplementation(() => ({
    hash: vi.fn().mockResolvedValue("mocked-hash"),
    verify: vi.fn().mockResolvedValue(true),
  })),
}));

// Mock JWT utilities
vi.mock("../utils/jwt", () => ({
  JwtUtils: vi.fn().mockImplementation(() => ({
    sign: vi.fn().mockResolvedValue("mock-jwt-token"),
  })),
}));

describe("AuthService", () => {
  let authService: AuthService;
  let mockUserOperations: MockUserOperations;
  let mockOrganizationOperations: MockOrganizationOperations;
  const mockDatabase = {} as Database;
  const jwtSecret = "test-secret";

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock operations setup
    mockUserOperations = {
      findByEmail: vi.fn(),
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
    };

    mockOrganizationOperations = {
      create: vi.fn(),
    };

    // Mock constructors
    const { UserOperations, OrganizationOperations } = await import("@repo/db");
    (UserOperations as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => mockUserOperations,
    );
    (
      OrganizationOperations as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => mockOrganizationOperations);

    authService = new AuthService(mockDatabase, jwtSecret);
  });

  describe("パスワードリセット機能", () => {
    describe("requestPasswordReset", () => {
      const validRequestInput = {
        email: "test@example.com",
      };

      it("有効なメールアドレスでリセット要求が成功する", async () => {
        // Arrange
        const mockUser = {
          id: "123e4567-e89b-12d3-a456-426614174000",
          email: "test@example.com",
          name: "Test User",
          passwordHash: "hashed-password",
          organizationId: null,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockUserOperations.findByEmail.mockResolvedValue({
          success: true,
          data: mockUser,
        });

        // Act
        const result = await authService.requestPasswordReset(validRequestInput);

        // Assert
        expect(result.success).toBe(true);
        expect(result.data?.message).toBe("Password reset instructions have been sent to your email");
        expect(mockUserOperations.findByEmail).toHaveBeenCalledWith("test@example.com");
      });

      it("存在しないメールアドレスでも成功レスポンスを返す（セキュリティ）", async () => {
        // Arrange
        mockUserOperations.findByEmail.mockResolvedValue({
          success: true,
          data: null,
        });

        // Act
        const result = await authService.requestPasswordReset(validRequestInput);

        // Assert
        expect(result.success).toBe(true);
        expect(result.data?.message).toBe("Password reset instructions have been sent to your email");
      });

      it("無効なメールアドレスでバリデーションエラーを返す", async () => {
        // Arrange
        const invalidInput = { email: "invalid-email" };

        // Act
        const result = await authService.requestPasswordReset(invalidInput);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBe("Validation failed");
      });

      it("データベースエラーで失敗する", async () => {
        // Arrange
        mockUserOperations.findByEmail.mockResolvedValue({
          success: false,
          error: "Database error",
        });

        // Act
        const result = await authService.requestPasswordReset(validRequestInput);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBe("Database error");
      });
    });

    describe("resetPassword", () => {
      const validResetInput = {
        token: "123456",
        password: "NewPassword123!",
      };

      it("有効なトークンでパスワードリセットが成功する", async () => {
        // Arrange
        const mockUser = {
          id: "123e4567-e89b-12d3-a456-426614174000",
          email: "test@example.com",
          name: "Test User",
          passwordHash: "old-hash",
          organizationId: null,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockUserOperations.findByEmail.mockResolvedValue({
          success: true,
          data: mockUser,
        });

        // パスワード更新のモック
        mockUserOperations.update.mockResolvedValue({
          success: true,
          data: { ...mockUser, passwordHash: "new-hash" },
        });

        // resetTokensMapに直接トークンを設定
        const validToken = "123456";
        const resetTokens = (authService as unknown as { resetTokens: Map<string, { email: string; expires: Date }> }).resetTokens;
        resetTokens.set(validToken, {
          email: "test@example.com",
          expires: new Date(Date.now() + 10 * 60 * 1000), // 10分後
        });
        
        // Act
        const result = await authService.resetPassword({
          token: validToken,
          password: "NewPassword123!",
        });

        // Assert
        expect(result.success).toBe(true);
        expect(result.data?.message).toBe("Password has been reset successfully");
        expect(mockUserOperations.update).toHaveBeenCalledWith(
          mockUser.id,
          { passwordHash: "mocked-hash" }
        );
      });

      it("無効なトークンでエラーを返す", async () => {
        // Arrange
        const invalidTokenInput = {
          token: "invalid-token",
          password: "NewPassword123!",
        };

        // Act
        const result = await authService.resetPassword(invalidTokenInput);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBe("Invalid or expired reset token");
      });

      it("弱いパスワードでバリデーションエラーを返す", async () => {
        // Arrange
        const weakPasswordInput = {
          token: "123456",
          password: "weak",
        };

        // Act
        const result = await authService.resetPassword(weakPasswordInput);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBe("Validation failed");
      });

      it("期限切れトークンでエラーを返す", async () => {
        // Arrange
        const mockUser = {
          id: "123e4567-e89b-12d3-a456-426614174000",
          email: "test@example.com",
          name: "Test User",
          passwordHash: "old-hash",
          organizationId: null,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockUserOperations.findByEmail.mockResolvedValue({
          success: true,
          data: mockUser,
        });

        // リセット要求を実行してトークンを生成
        await authService.requestPasswordReset({ email: "test@example.com" });

        // 時間を進めてトークンを期限切れにする
        vi.useFakeTimers();
        vi.advanceTimersByTime(16 * 60 * 1000); // 16分進める

        // Act
        const result = await authService.resetPassword(validResetInput);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBe("Invalid or expired reset token");

        vi.useRealTimers();
      });

      it("パスワード更新に失敗した場合エラーを返す", async () => {
        // Arrange
        const mockUser = {
          id: "123e4567-e89b-12d3-a456-426614174000",
          email: "test@example.com",
          name: "Test User",
          passwordHash: "old-hash",
          organizationId: null,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockUserOperations.findByEmail.mockResolvedValue({
          success: true,
          data: mockUser,
        });

        // パスワード更新失敗のモック
        mockUserOperations.update.mockResolvedValue({
          success: false,
          error: "Update failed",
        });

        // resetTokensMapに直接トークンを設定
        const validToken = "789012";
        const resetTokens = (authService as unknown as { resetTokens: Map<string, { email: string; expires: Date }> }).resetTokens;
        resetTokens.set(validToken, {
          email: "test@example.com",
          expires: new Date(Date.now() + 10 * 60 * 1000), // 10分後
        });

        // Act
        const result = await authService.resetPassword({
          token: validToken,
          password: "NewPassword123!",
        });

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBe("Password update failed");
      });
    });

    describe("トークン管理", () => {
      it("期限切れトークンを自動的にクリーンアップする", async () => {
        // Arrange
        const mockUser = {
          id: "123e4567-e89b-12d3-a456-426614174000",
          email: "test@example.com",
          name: "Test User",
          passwordHash: "hash",
          organizationId: null,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockUserOperations.findByEmail.mockResolvedValue({
          success: true,
          data: mockUser,
        });

        // 複数のリセット要求を実行
        await authService.requestPasswordReset({ email: "test@example.com" });
        await authService.requestPasswordReset({ email: "test2@example.com" });

        vi.useFakeTimers();
        vi.advanceTimersByTime(16 * 60 * 1000); // 16分進める

        // 新しいリセット要求を実行（クリーンアップがトリガーされる）
        await authService.requestPasswordReset({ email: "test3@example.com" });

        // 期限切れトークンでリセットを試行
        const result = await authService.resetPassword({
          token: "123456", // 期限切れになったトークン
          password: "NewPassword123!",
        });

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBe("Invalid or expired reset token");

        vi.useRealTimers();
      });
    });
  });
});