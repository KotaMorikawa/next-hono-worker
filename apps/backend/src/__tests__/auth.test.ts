import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import { JwtUtils } from '../utils/jwt'
import { jwtAuth } from '../middleware/auth'

describe('JWT認証ミドルウェア', () => {
  let jwtUtils: JwtUtils
  const secretKey = 'test-secret-key-for-jwt-development'
  const mockPayload = {
    userId: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    organizationId: '987e6543-e21b-34d5-a678-426614174999'
  }

  beforeEach(() => {
    jwtUtils = new JwtUtils(secretKey)
  })

  describe('JWT署名と検証', () => {
    it('正常なペイロードで有効なJWTトークンを生成できる', async () => {
      // Act
      const token = await jwtUtils.sign(mockPayload)
      
      // Assert
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3) // Header.Payload.Signature
    })

    it('生成されたJWTトークンを正常に検証できる', async () => {
      // Arrange
      const token = await jwtUtils.sign(mockPayload)
      
      // Act
      const verifiedPayload = await jwtUtils.verify(token)
      
      // Assert
      expect(verifiedPayload.userId).toBe(mockPayload.userId)
      expect(verifiedPayload.email).toBe(mockPayload.email)
      expect(verifiedPayload.organizationId).toBe(mockPayload.organizationId)
      expect(verifiedPayload.iat).toBeDefined()
      expect(verifiedPayload.exp).toBeDefined()
    })

    it('不正なトークンの検証で例外をスローする', async () => {
      // Arrange
      const invalidToken = 'invalid.jwt.token'
      
      // Act & Assert
      await expect(jwtUtils.verify(invalidToken)).rejects.toThrow('Invalid JWT token')
    })

    it('期限切れトークンの検証で例外をスローする', async () => {
      // Arrange
      const expiredPayload = { ...mockPayload }
      const token = await jwtUtils.sign(expiredPayload, { expiresIn: -1 }) // 過去の時刻
      
      // Act & Assert
      await expect(jwtUtils.verify(token)).rejects.toThrow('JWT token has expired')
    })
  })

  describe('JWT認証ミドルウェア', () => {
    let app: Hono
    let validToken: string

    beforeEach(async () => {
      app = new Hono()
      validToken = await jwtUtils.sign(mockPayload)
      
      // ミドルウェアをセットアップ
      app.use('/protected/*', jwtAuth({ secretKey }))
      
      // 保護されたエンドポイント
      app.get('/protected/data', (c) => {
        const user = c.get('user')
        return c.json({ 
          message: 'Protected data accessed',
          user 
        })
      })
      
      // 保護されていないエンドポイント
      app.get('/public', (c) => {
        return c.json({ message: 'Public endpoint' })
      })
    })

    it('Authorizationヘッダーなしで保護されたエンドポイントにアクセスすると401を返す', async () => {
      // Act
      const res = await app.request('/protected/data')
      
      // Assert
      expect(res.status).toBe(401)
      const data = await res.json() as { error: string }
      expect(data.error).toBe('Authorization header is required')
    })

    it('無効なトークンで保護されたエンドポイントにアクセスすると401を返す', async () => {
      // Act
      const res = await app.request('/protected/data', {
        headers: {
          'Authorization': 'Bearer invalid.jwt.token'
        }
      })
      
      // Assert
      expect(res.status).toBe(401)
      const data = await res.json() as { error: string }
      expect(data.error).toBe('Invalid or expired token')
    })

    it('有効なトークンで保護されたエンドポイントにアクセスできる', async () => {
      // Act
      const res = await app.request('/protected/data', {
        headers: {
          'Authorization': `Bearer ${validToken}`
        }
      })
      
      // Assert
      expect(res.status).toBe(200)
      const data = await res.json() as { message: string; user: { userId: string; email: string } }
      expect(data.message).toBe('Protected data accessed')
      expect(data.user.userId).toBe(mockPayload.userId)
      expect(data.user.email).toBe(mockPayload.email)
    })

    it('Bearer形式でないAuthorizationヘッダーで401を返す', async () => {
      // Act
      const res = await app.request('/protected/data', {
        headers: {
          'Authorization': `Basic ${validToken}`
        }
      })
      
      // Assert
      expect(res.status).toBe(401)
      const data = await res.json() as { error: string }
      expect(data.error).toBe('Bearer token is required')
    })

    it('保護されていないエンドポイントには認証なしでアクセスできる', async () => {
      // Act
      const res = await app.request('/public')
      
      // Assert
      expect(res.status).toBe(200)
      const data = await res.json() as { message: string }
      expect(data.message).toBe('Public endpoint')
    })
  })
})