import { describe, it, expect } from 'vitest'
import app from '../index'

describe('Generator API統合テスト - 実際のアプリケーション', () => {
  describe('エンドポイント存在確認', () => {
    it('ルートエンドポイントがgeneratorエンドポイント情報を返す', async () => {
      const res = await app.request('/')
      
      expect(res.status).toBe(200)
      const data = await res.json() as {
        endpoints: {
          authenticated: string[]
        }
      }
      
      expect(data.endpoints.authenticated).toContain('/internal/generator/*')
    })
  })

  describe('認証必須エンドポイント', () => {
    it('GET /internal/generator/list は認証なしで401を返す', async () => {
      const res = await app.request('/internal/generator/list')
      
      expect(res.status).toBe(401)
      const data = await res.json() as { error: string }
      expect(data.error).toBe('Authorization header is required')
    })

    it('POST /internal/generator/create は認証なしで401を返す', async () => {
      const res = await app.request('/internal/generator/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: '天気情報を取得するAPIを作成してください',
          category: 'data',
          complexityLevel: 'simple'
        })
      })
      
      expect(res.status).toBe(401)
      const data = await res.json() as { error: string }
      expect(data.error).toBe('Authorization header is required')
    })

    it('GET /internal/generator/test-id は認証なしで401を返す', async () => {
      const res = await app.request('/internal/generator/test-id')
      
      expect(res.status).toBe(401)
      const data = await res.json() as { error: string }
      expect(data.error).toBe('Authorization header is required')
    })

    it('DELETE /internal/generator/test-id は認証なしで401を返す', async () => {
      const res = await app.request('/internal/generator/test-id', {
        method: 'DELETE'
      })
      
      expect(res.status).toBe(401)
      const data = await res.json() as { error: string }
      expect(data.error).toBe('Authorization header is required')
    })
  })

  describe('APIルーティング構造', () => {
    it('generator関連は /internal/generator/* で統一されている', async () => {
      const generatorEndpoints = [
        { method: 'GET', path: '/internal/generator/list' },
        { method: 'POST', path: '/internal/generator/create' },
        { method: 'GET', path: '/internal/generator/test-id' },
        { method: 'DELETE', path: '/internal/generator/test-id' }
      ]

      for (const endpoint of generatorEndpoints) {
        const res = await app.request(endpoint.path, {
          method: endpoint.method,
          headers: { 'Content-Type': 'application/json' },
          body: endpoint.method === 'POST' ? JSON.stringify({
            description: 'test api',
            category: 'data',
            complexityLevel: 'simple'
          }) : undefined
        })
        
        // 404でないことを確認（エンドポイントが存在し、認証で401を返す）
        expect(res.status).toBe(401)
      }
    })

    it('x402決済エンドポイントは引き続き動作する', async () => {
      const res = await app.request('/protected/demo')
      
      // x402決済が必要なため402ステータス
      expect(res.status).toBe(402)
    })

    it('既存の認証済みエンドポイントは引き続き動作する', async () => {
      const res = await app.request('/auth/profile')
      
      // JWT認証が必要なため401ステータス
      expect(res.status).toBe(401)
    })
  })

  describe('エラーハンドリング', () => {
    it('存在しないgeneratorエンドポイントで認証エラーを返す', async () => {
      const res = await app.request('/internal/generator/nonexistent-endpoint')
      
      // 認証ミドルウェアが先に実行されるため401が返される
      expect(res.status).toBe(401)
    })

    it('無効なJSONで適切なエラーを返す', async () => {
      const res = await app.request('/internal/generator/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json'
      })
      
      // 認証なしなので401、または無効JSONの場合は400が期待される
      expect([400, 401].includes(res.status)).toBe(true)
    })
  })
})