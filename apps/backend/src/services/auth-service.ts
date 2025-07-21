import type { Database } from '@repo/db'
import { UserOperations, OrganizationOperations } from '@repo/db'
import { loginSchema, registerSchema } from '@repo/shared/auth'
import type { LoginInput, RegisterInput, JwtPayload } from '@repo/shared/auth'
import { PasswordUtils } from '../utils/password'
import { JwtUtils } from '../utils/jwt'

export interface AuthResult {
  success: boolean
  data?: {
    user: {
      id: string
      email: string
      name: string
      organizationId: string | null
    }
    token: string
  }
  error?: string
}

export class AuthService {
  private userOperations: UserOperations
  private organizationOperations: OrganizationOperations
  private passwordUtils: PasswordUtils
  private jwtUtils: JwtUtils

  constructor(database: Database, jwtSecret: string) {
    this.userOperations = new UserOperations(database)
    this.organizationOperations = new OrganizationOperations(database)
    this.passwordUtils = new PasswordUtils()
    this.jwtUtils = new JwtUtils(jwtSecret)
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    try {
      // バリデーション
      const validationResult = registerSchema.safeParse(input)
      if (!validationResult.success) {
        return {
          success: false,
          error: 'Validation failed'
        }
      }

      const { email, password, name, organizationName } = validationResult.data

      // 既存ユーザーチェック
      const existingUserResult = await this.userOperations.findByEmail(email)
      if (!existingUserResult.success) {
        return {
          success: false,
          error: 'Database error during user lookup'
        }
      }

      if (existingUserResult.data) {
        return {
          success: false,
          error: 'Email already exists'
        }
      }

      // パスワードハッシュ化
      const passwordHash = await this.passwordUtils.hash(password)

      // 組織作成（組織名が提供された場合）
      let organizationId: string | null = null
      if (organizationName) {
        const orgResult = await this.organizationOperations.create({
          name: organizationName,
          domain: null
        })
        
        if (!orgResult.success) {
          return {
            success: false,
            error: 'Organization creation failed'
          }
        }
        organizationId = orgResult.data.id
      }

      // ユーザー作成
      const userResult = await this.userOperations.create({
        email,
        name,
        passwordHash,
        organizationId,
        emailVerified: false
      })

      if (!userResult.success) {
        return {
          success: false,
          error: 'User registration failed'
        }
      }

      const user = userResult.data

      // JWTトークン生成
      const tokenPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
        userId: user.id,
        email: user.email,
        organizationId: user.organizationId
      }

      const token = await this.jwtUtils.sign(tokenPayload)

      return {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            organizationId: user.organizationId
          },
          token
        }
      }
    } catch (_error) {
      return {
        success: false,
        error: 'Registration failed'
      }
    }
  }

  async login(input: LoginInput): Promise<AuthResult> {
    try {
      // バリデーション
      const validationResult = loginSchema.safeParse(input)
      if (!validationResult.success) {
        return {
          success: false,
          error: 'Invalid credentials'
        }
      }

      const { email, password } = validationResult.data

      // ユーザー検索
      const userResult = await this.userOperations.findByEmail(email)
      if (!userResult.success) {
        return {
          success: false,
          error: 'Database error'
        }
      }

      if (!userResult.data) {
        return {
          success: false,
          error: 'Invalid credentials'
        }
      }

      const user = userResult.data

      // パスワード検証
      const isValidPassword = await this.passwordUtils.verify(password, user.passwordHash)
      if (!isValidPassword) {
        return {
          success: false,
          error: 'Invalid credentials'
        }
      }

      // JWTトークン生成
      const tokenPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
        userId: user.id,
        email: user.email,
        organizationId: user.organizationId
      }

      const token = await this.jwtUtils.sign(tokenPayload)

      return {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            organizationId: user.organizationId
          },
          token
        }
      }
    } catch (_error) {
      return {
        success: false,
        error: 'Login failed'
      }
    }
  }
}