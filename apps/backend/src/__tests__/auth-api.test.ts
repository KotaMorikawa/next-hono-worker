import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import { authRoutes } from '../routes/auth'

// Mock types for test interfaces
interface MockUserOperations {
  findByEmail: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  findById: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}

interface MockOrganizationOperations {
  create: ReturnType<typeof vi.fn>
}

type MockCreateDatabaseConnection = ReturnType<typeof vi.fn>

// createDatabaseConnectionをモック化
vi.mock('@repo/db', () => ({
  createDatabaseConnection: vi.fn(),
  UserOperations: vi.fn(),
  OrganizationOperations: vi.fn()
}))

// パスワードユーティリティをモック化
vi.mock('../utils/password', () => ({
  PasswordUtils: vi.fn().mockImplementation(() => ({
    hash: vi.fn().mockResolvedValue('mocked-hash'),
    verify: vi.fn().mockImplementation(async (password: string, hash: string) => {
      // テスト用の条件分岐
      if (password === 'TestPassword123!' && hash.includes('YWFhYWFhYWFhYWFhYWFhYQ==')) {
        return true
      }
      return false
    })
  }))
}))

// JWTユーティリティをモック化
vi.mock('../utils/jwt', () => ({
  JwtUtils: vi.fn().mockImplementation(() => ({
    sign: vi.fn().mockResolvedValue('mock-jwt-token')
  }))
}))

describe('ユーザー管理API', () => {
  let app: Hono
  let mockUserOperations: MockUserOperations
  let mockOrganizationOperations: MockOrganizationOperations
  let mockCreateDatabaseConnection: MockCreateDatabaseConnection

  beforeEach(async () => {
    app = new Hono()
    
    // モックをリセット
    vi.clearAllMocks()
    
    // UserOperationsのモック設定
    mockUserOperations = {
      findByEmail: vi.fn(),
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn()
    }
    
    // OrganizationOperationsのモック設定
    mockOrganizationOperations = {
      create: vi.fn()
    }
    
    // createDatabaseConnectionのモック設定
    mockCreateDatabaseConnection = vi.fn().mockResolvedValue({})
    
    // モジュールのモック設定を更新
    const { createDatabaseConnection, UserOperations, OrganizationOperations } = await import('@repo/db')
    ;(createDatabaseConnection as MockCreateDatabaseConnection).mockImplementation(mockCreateDatabaseConnection)
    ;(UserOperations as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => mockUserOperations)
    ;(OrganizationOperations as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => mockOrganizationOperations)
    
    // 認証ルートを設定
    app.route('/internal/auth', authRoutes)
  })

  describe('POST /internal/auth/register - ユーザー登録', () => {
    const validRegisterData = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!',
      name: 'Test User',
      organizationName: 'Test Organization'
    }

    it('有効なデータでユーザー登録が成功する', async () => {
      // Arrange
      mockUserOperations.findByEmail.mockResolvedValue({ success: true, data: null })
      mockOrganizationOperations.create.mockResolvedValue({
        success: true,
        data: { id: '987e6543-e21b-34d5-a678-426614174999' }
      })
      mockUserOperations.create.mockResolvedValue({
        success: true,
        data: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'test@example.com',
          name: 'Test User',
          organizationId: '987e6543-e21b-34d5-a678-426614174999',
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
      
      // Act
      const res = await app.request('/internal/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRegisterData)
      })
      
      // Assert
      expect(res.status).toBe(201)
      const data = await res.json() as { 
        success: boolean; 
        data: { 
          user: { id: string; email: string; name: string };
          token: string 
        };
        message: string 
      }
      
      expect(data.success).toBe(true)
      expect(data.data.user.email).toBe('test@example.com')
      expect(data.data.user.name).toBe('Test User')
      expect(data.data.token).toBeDefined()
      expect(data.message).toBe('User registered successfully')
    })

    it('無効なメールアドレスで400エラーを返す', async () => {
      // Arrange
      const invalidData = { ...validRegisterData, email: 'invalid-email' }
      
      // Act
      const res = await app.request('/internal/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData)
      })
      
      // Assert
      expect(res.status).toBe(400)
      const data = await res.json() as { error: string; details: unknown }
      expect(data.error).toBe('Validation failed')
      expect(data.details).toBeDefined()
    })

    it('パスワード不一致で400エラーを返す', async () => {
      // Arrange
      const invalidData = { 
        ...validRegisterData, 
        confirmPassword: 'DifferentPassword123!' 
      }
      
      // Act
      const res = await app.request('/internal/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData)
      })
      
      // Assert
      expect(res.status).toBe(400)
      const data = await res.json() as { error: string }
      expect(data.error).toBe('Validation failed')
    })

    it('既存ユーザーメールで409エラーを返す', async () => {
      // Arrange
      mockUserOperations.findByEmail.mockResolvedValue({
        success: true,
        data: { id: 'existing-user-id', email: 'test@example.com' }
      })
      
      // Act
      const res = await app.request('/internal/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRegisterData)
      })
      
      // Assert
      expect(res.status).toBe(409)
      const data = await res.json() as { error: string }
      expect(data.error).toBe('Email already exists')
    })

    it('DB作成エラーで500エラーを返す', async () => {
      // Arrange
      mockUserOperations.findByEmail.mockResolvedValue({ success: true, data: null })
      mockOrganizationOperations.create.mockResolvedValue({
        success: true,
        data: { id: '987e6543-e21b-34d5-a678-426614174999' }
      })
      mockUserOperations.create.mockResolvedValue({
        success: false,
        error: new Error('Database error')
      })
      
      // Act
      const res = await app.request('/internal/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRegisterData)
      })
      
      // Assert
      expect(res.status).toBe(500)
      const data = await res.json() as { error: string }
      expect(data.error).toBe('User registration failed')
    })
  })

  describe('POST /internal/auth/login - ログイン', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'TestPassword123!'
    }

    it('有効な認証情報でログインが成功する', async () => {
      // Arrange
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: '100000$YWFhYWFhYWFhYWFhYWFhYQ==$dGVzdGhhc2hhc2hhc2hhc2hhc2hhc2hhc2hhc2g=',
        organizationId: '987e6543-e21b-34d5-a678-426614174999',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockUserOperations.findByEmail.mockResolvedValue({
        success: true,
        data: mockUser
      })
      
      // Act
      const res = await app.request('/internal/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLoginData)
      })
      
      // Assert
      expect(res.status).toBe(200)
      const data = await res.json() as { 
        success: boolean;
        data: { 
          user: { id: string; email: string; name: string };
          token: string 
        };
        message: string 
      }
      
      expect(data.success).toBe(true)
      expect(data.data.user.email).toBe('test@example.com')
      expect(data.data.token).toBeDefined()
      expect(data.message).toBe('Login successful')
    })

    it('存在しないユーザーで401エラーを返す', async () => {
      // Arrange
      mockUserOperations.findByEmail.mockResolvedValue({ success: true, data: null })
      
      // Act
      const res = await app.request('/internal/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLoginData)
      })
      
      // Assert
      expect(res.status).toBe(401)
      const data = await res.json() as { error: string }
      expect(data.error).toBe('Invalid credentials')
    })

    it('間違ったパスワードで401エラーを返す', async () => {
      // Arrange
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        passwordHash: 'different-hash',
        organizationId: null
      }

      mockUserOperations.findByEmail.mockResolvedValue({
        success: true,
        data: mockUser
      })
      
      // Act
      const res = await app.request('/internal/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLoginData)
      })
      
      // Assert
      expect(res.status).toBe(401)
      const data = await res.json() as { error: string }
      expect(data.error).toBe('Invalid credentials')
    })
  })
})