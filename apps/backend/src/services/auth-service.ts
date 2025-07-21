// Database type will be inferred from @repo/db
import {
  type Database,
  OrganizationOperations,
  UserOperations,
} from "@repo/db";
import type {
  JwtPayload,
  LoginInput,
  PasswordResetInput,
  PasswordResetRequestInput,
  RegisterInput,
} from "@repo/shared/auth";
import {
  loginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  registerSchema,
} from "@repo/shared/auth";
import { JwtUtils } from "../utils/jwt";
import { PasswordUtils } from "../utils/password";

export interface AuthResult {
  success: boolean;
  data?: {
    user: {
      id: string;
      email: string;
      name: string;
      organizationId: string | null;
    };
    token: string;
  };
  error?: string;
}

export interface PasswordResetResult {
  success: boolean;
  data?: {
    message: string;
  };
  error?: string;
}

export class AuthService {
  private userOperations: InstanceType<typeof UserOperations>;
  private organizationOperations: InstanceType<typeof OrganizationOperations>;
  private passwordUtils: PasswordUtils;
  private jwtUtils: JwtUtils;
  private resetTokens: Map<string, { email: string; expires: Date }> =
    new Map();

  constructor(database: Database, jwtSecret: string) {
    this.userOperations = new UserOperations(database);
    this.organizationOperations = new OrganizationOperations(database);
    this.passwordUtils = new PasswordUtils();
    this.jwtUtils = new JwtUtils(jwtSecret);
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    try {
      // バリデーション
      const validationResult = registerSchema.safeParse(input);
      if (!validationResult.success) {
        return {
          success: false,
          error: "Validation failed",
        };
      }

      const { email, password, name, organizationName } = validationResult.data;

      // 既存ユーザーチェック
      const existingUserResult = await this.userOperations.findByEmail(email);
      if (!existingUserResult.success) {
        return {
          success: false,
          error: "Database error during user lookup",
        };
      }

      if (existingUserResult.data) {
        return {
          success: false,
          error: "Email already exists",
        };
      }

      // パスワードハッシュ化
      const passwordHash = await this.passwordUtils.hash(password);

      // 組織作成（組織名が提供された場合）
      let organizationId: string | null = null;
      if (organizationName) {
        const orgResult = await this.organizationOperations.create({
          name: organizationName,
          domain: null,
        });

        if (!orgResult.success) {
          return {
            success: false,
            error: "Organization creation failed",
          };
        }
        organizationId = orgResult.data.id;
      }

      // ユーザー作成
      const userResult = await this.userOperations.create({
        email,
        name,
        passwordHash,
        organizationId,
        emailVerified: false,
      });

      if (!userResult.success) {
        return {
          success: false,
          error: "User registration failed",
        };
      }

      const user = userResult.data;

      // JWTトークン生成
      const tokenPayload: Omit<JwtPayload, "iat" | "exp"> = {
        userId: user.id,
        email: user.email,
        organizationId: user.organizationId,
      };

      const token = await this.jwtUtils.sign(tokenPayload);

      return {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            organizationId: user.organizationId,
          },
          token,
        },
      };
    } catch (_error) {
      return {
        success: false,
        error: "Registration failed",
      };
    }
  }

  async login(input: LoginInput): Promise<AuthResult> {
    try {
      // バリデーション
      const validationResult = loginSchema.safeParse(input);
      if (!validationResult.success) {
        return {
          success: false,
          error: "Invalid credentials",
        };
      }

      const { email, password } = validationResult.data;

      // ユーザー検索
      const userResult = await this.userOperations.findByEmail(email);
      if (!userResult.success) {
        return {
          success: false,
          error: "Database error",
        };
      }

      if (!userResult.data) {
        return {
          success: false,
          error: "Invalid credentials",
        };
      }

      const user = userResult.data;

      // パスワード検証
      const isValidPassword = await this.passwordUtils.verify(
        password,
        user.passwordHash,
      );
      if (!isValidPassword) {
        return {
          success: false,
          error: "Invalid credentials",
        };
      }

      // JWTトークン生成
      const tokenPayload: Omit<JwtPayload, "iat" | "exp"> = {
        userId: user.id,
        email: user.email,
        organizationId: user.organizationId,
      };

      const token = await this.jwtUtils.sign(tokenPayload);

      return {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            organizationId: user.organizationId,
          },
          token,
        },
      };
    } catch (_error) {
      return {
        success: false,
        error: "Login failed",
      };
    }
  }

  async requestPasswordReset(
    input: PasswordResetRequestInput,
  ): Promise<PasswordResetResult> {
    try {
      // バリデーション
      const validationResult = passwordResetRequestSchema.safeParse(input);
      if (!validationResult.success) {
        return {
          success: false,
          error: "Validation failed",
        };
      }

      const { email } = validationResult.data;

      // ユーザー存在確認
      const userResult = await this.userOperations.findByEmail(email);
      if (!userResult.success) {
        return {
          success: false,
          error: "Database error",
        };
      }

      if (!userResult.data) {
        // セキュリティ上、存在しないメールアドレスでも成功レスポンスを返す
        return {
          success: true,
          data: {
            message: "Password reset instructions have been sent to your email",
          },
        };
      }

      // リセットトークン生成（6桁の数字）
      const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 15 * 60 * 1000); // 15分後

      // トークンを保存
      this.resetTokens.set(resetToken, { email, expires });

      // 期限切れトークンのクリーンアップ
      this.cleanupExpiredTokens();

      // 実際のアプリケーションでは、ここでメール送信を行う
      console.log(`Password reset token for ${email}: ${resetToken}`);

      return {
        success: true,
        data: {
          message: "Password reset instructions have been sent to your email",
        },
      };
    } catch (_error) {
      return {
        success: false,
        error: "Password reset request failed",
      };
    }
  }

  async resetPassword(input: PasswordResetInput): Promise<PasswordResetResult> {
    try {
      // バリデーション
      const validationResult = passwordResetSchema.safeParse(input);
      if (!validationResult.success) {
        return {
          success: false,
          error: "Validation failed",
        };
      }

      const { token, password } = validationResult.data;

      // トークン検証
      const tokenData = this.resetTokens.get(token);
      if (!tokenData) {
        return {
          success: false,
          error: "Invalid or expired reset token",
        };
      }

      // 有効期限チェック
      if (new Date() > tokenData.expires) {
        this.resetTokens.delete(token);
        return {
          success: false,
          error: "Invalid or expired reset token",
        };
      }

      // ユーザー検索
      const userResult = await this.userOperations.findByEmail(tokenData.email);
      if (!userResult.success || !userResult.data) {
        return {
          success: false,
          error: "User not found",
        };
      }

      // パスワードハッシュ化
      const passwordHash = await this.passwordUtils.hash(password);

      // パスワード更新
      const updateResult = await this.userOperations.update(
        userResult.data.id,
        {
          passwordHash,
        },
      );

      if (!updateResult.success) {
        return {
          success: false,
          error: "Password update failed",
        };
      }

      // 使用済みトークンを削除
      this.resetTokens.delete(token);

      return {
        success: true,
        data: {
          message: "Password has been reset successfully",
        },
      };
    } catch (_error) {
      return {
        success: false,
        error: "Password reset failed",
      };
    }
  }

  private cleanupExpiredTokens(): void {
    const now = new Date();
    for (const [token, data] of this.resetTokens.entries()) {
      if (now > data.expires) {
        this.resetTokens.delete(token);
      }
    }
  }
}
