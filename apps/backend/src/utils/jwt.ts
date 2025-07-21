// JWT ユーティリティクラス - Web Crypto API使用
export interface JwtPayload {
  userId: string
  email: string
  organizationId: string | null
  iat: number
  exp: number
}

export interface SignOptions {
  expiresIn?: number // 秒単位（デフォルト24時間）
}

export class JwtUtils {
  private secretKey: string

  constructor(secretKey: string) {
    this.secretKey = secretKey
  }

  async sign(payload: Omit<JwtPayload, 'iat' | 'exp'>, options: SignOptions = {}): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    const expiresIn = options.expiresIn ?? 24 * 60 * 60 // デフォルト24時間
    
    const fullPayload: JwtPayload = {
      ...payload,
      iat: now,
      exp: now + expiresIn
    }

    // JWTヘッダー
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    }

    // Base64URL エンコード
    const encodedHeader = this.base64urlEncode(JSON.stringify(header))
    const encodedPayload = this.base64urlEncode(JSON.stringify(fullPayload))
    
    // 署名対象データ
    const signatureInput = `${encodedHeader}.${encodedPayload}`
    
    // HMAC-SHA256で署名
    const signature = await this.createSignature(signatureInput)
    const encodedSignature = this.base64urlEncode(signature)
    
    return `${signatureInput}.${encodedSignature}`
  }

  async verify(token: string): Promise<JwtPayload> {
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid JWT token')
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts
    
    // 署名検証
    const signatureInput = `${encodedHeader}.${encodedPayload}`
    const expectedSignature = await this.createSignature(signatureInput)
    const expectedEncodedSignature = this.base64urlEncode(expectedSignature)
    
    if (encodedSignature !== expectedEncodedSignature) {
      throw new Error('Invalid JWT token')
    }

    // ペイロード解析
    const payload: JwtPayload = JSON.parse(this.base64urlDecode(encodedPayload))
    
    // 有効期限チェック
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp <= now) {
      throw new Error('JWT token has expired')
    }

    return payload
  }

  private async createSignature(data: string): Promise<string> {
    // Web Crypto APIでHMAC-SHA256署名
    const encoder = new TextEncoder()
    const keyData = encoder.encode(this.secretKey)
    const messageData = encoder.encode(data)
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
    return String.fromCharCode(...new Uint8Array(signature))
  }

  private base64urlEncode(str: string): string {
    // Base64URLエンコード（RFC 7515準拠）
    const base64 = btoa(str)
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }

  private base64urlDecode(str: string): string {
    // Base64URLデコード
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
    // パディング調整
    while (base64.length % 4) {
      base64 += '='
    }
    return atob(base64)
  }
}