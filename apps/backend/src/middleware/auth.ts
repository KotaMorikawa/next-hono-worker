import type { Context, Next, MiddlewareHandler } from 'hono'
import { JwtUtils, type JwtPayload } from '../utils/jwt'

// Honoのコンテキストを拡張してuser情報を追加
declare module 'hono' {
  interface ContextVariableMap {
    user: JwtPayload
  }
}

export interface JwtAuthOptions {
  secretKey: string
}

export function jwtAuth(options: JwtAuthOptions): MiddlewareHandler {
  const jwtUtils = new JwtUtils(options.secretKey)

  return async (c: Context, next: Next) => {
    try {
      // Authorizationヘッダーを取得
      const authHeader = c.req.header('Authorization')
      
      if (!authHeader) {
        return c.json(
          { error: 'Authorization header is required' },
          401
        )
      }

      // Bearer形式かチェック
      if (!authHeader.startsWith('Bearer ')) {
        return c.json(
          { error: 'Bearer token is required' },
          401
        )
      }

      // トークンを抽出
      const token = authHeader.slice(7) // 'Bearer ' を除去
      
      // JWTトークンを検証
      const payload = await jwtUtils.verify(token)
      
      // ユーザー情報をコンテキストに設定
      c.set('user', payload)
      
      // 次のミドルウェアまたはハンドラーに進む
      await next()
      
    } catch (_error) {
      // JWT検証エラーまたはその他のエラー
      return c.json(
        { error: 'Invalid or expired token' },
        401
      )
    }
  }
}