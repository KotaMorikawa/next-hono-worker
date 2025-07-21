import { describe, it, expect, beforeEach } from 'vitest'
import { PasswordUtils } from '../utils/password'

describe('パスワードハッシュ化ユーティリティ', () => {
  let passwordUtils: PasswordUtils

  beforeEach(() => {
    passwordUtils = new PasswordUtils()
  })

  describe('パスワードハッシュ化', () => {
    it('パスワードを安全にハッシュ化できる', async () => {
      // Arrange
      const password = 'TestPassword123!'
      
      // Act
      const hashedPassword = await passwordUtils.hash(password)
      
      // Assert
      expect(typeof hashedPassword).toBe('string')
      expect(hashedPassword).not.toBe(password)
      expect(hashedPassword.length).toBeGreaterThan(50) // ソルト + ハッシュで十分な長さ
    })

    it('同じパスワードでも毎回異なるハッシュを生成する', async () => {
      // Arrange
      const password = 'TestPassword123!'
      
      // Act
      const hash1 = await passwordUtils.hash(password)
      const hash2 = await passwordUtils.hash(password)
      
      // Assert
      expect(hash1).not.toBe(hash2)
    })

    it('空文字列パスワードではエラーをスローする', async () => {
      // Act & Assert
      await expect(passwordUtils.hash('')).rejects.toThrow('Password cannot be empty')
    })
  })

  describe('パスワード検証', () => {
    it('正しいパスワードで検証が成功する', async () => {
      // Arrange
      const password = 'TestPassword123!'
      const hashedPassword = await passwordUtils.hash(password)
      
      // Act
      const isValid = await passwordUtils.verify(password, hashedPassword)
      
      // Assert
      expect(isValid).toBe(true)
    })

    it('間違ったパスワードで検証が失敗する', async () => {
      // Arrange
      const password = 'TestPassword123!'
      const wrongPassword = 'WrongPassword456!'
      const hashedPassword = await passwordUtils.hash(password)
      
      // Act
      const isValid = await passwordUtils.verify(wrongPassword, hashedPassword)
      
      // Assert
      expect(isValid).toBe(false)
    })

    it('不正なハッシュ形式でエラーをスローする', async () => {
      // Arrange
      const password = 'TestPassword123!'
      const invalidHash = 'invalid-hash-format'
      
      // Act & Assert
      await expect(passwordUtils.verify(password, invalidHash)).rejects.toThrow('Invalid hash format')
    })
  })

  describe('セキュリティ要件', () => {
    it('PBKDF2-SHA256で十分な反復回数を使用する', async () => {
      // Arrange
      const password = 'TestPassword123!'
      
      // Act
      const hashedPassword = await passwordUtils.hash(password)
      
      // Assert
      // ハッシュ形式: iteration$salt$hash
      const parts = hashedPassword.split('$')
      expect(parts).toHaveLength(3)
      
      const iterations = Number.parseInt(parts[0])
      expect(iterations).toBeGreaterThanOrEqual(100000) // OWASP推奨
    })

    it('暗号学的に安全なソルトを生成する', async () => {
      // Arrange
      const password = 'TestPassword123!'
      
      // Act
      const hash1 = await passwordUtils.hash(password)
      const hash2 = await passwordUtils.hash(password)
      
      // Assert
      const salt1 = hash1.split('$')[1]
      const salt2 = hash2.split('$')[1]
      
      expect(salt1).not.toBe(salt2)
      expect(salt1.length).toBeGreaterThanOrEqual(22) // 16バイトのBase64（22-24文字）
    })
  })
})