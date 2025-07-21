// パスワードハッシュ化ユーティリティ - Web Crypto API使用
export class PasswordUtils {
  private static readonly ITERATIONS = 100000 // OWASP推奨
  private static readonly SALT_LENGTH = 16 // 16バイト
  private static readonly HASH_LENGTH = 32 // 32バイト (SHA-256)

  async hash(password: string): Promise<string> {
    if (!password || password.length === 0) {
      throw new Error('Password cannot be empty')
    }

    // 暗号学的に安全なソルトを生成
    const salt = crypto.getRandomValues(new Uint8Array(PasswordUtils.SALT_LENGTH))
    
    // パスワードをUint8Arrayに変換
    const passwordBuffer = new TextEncoder().encode(password)
    
    // PBKDF2でハッシュ化
    const hashBuffer = await this.pbkdf2(passwordBuffer, salt, PasswordUtils.ITERATIONS)
    
    // Base64エンコードして保存形式を作成
    const saltBase64 = this.uint8ArrayToBase64(salt)
    const hashBase64 = this.uint8ArrayToBase64(new Uint8Array(hashBuffer))
    
    // 形式: iterations$salt$hash
    return `${PasswordUtils.ITERATIONS}$${saltBase64}$${hashBase64}`
  }

  async verify(password: string, hashedPassword: string): Promise<boolean> {
    try {
      // ハッシュ形式を解析
      const parts = hashedPassword.split('$')
      if (parts.length !== 3) {
        throw new Error('Invalid hash format')
      }

      const iterations = Number.parseInt(parts[0])
      const saltBase64 = parts[1]
      const storedHashBase64 = parts[2]

      // Base64デコード
      const salt = this.base64ToUint8Array(saltBase64)
      const storedHash = this.base64ToUint8Array(storedHashBase64)

      // 入力パスワードを同じ条件でハッシュ化
      const passwordBuffer = new TextEncoder().encode(password)
      const computedHashBuffer = await this.pbkdf2(passwordBuffer, salt, iterations)
      const computedHash = new Uint8Array(computedHashBuffer)

      // 定数時間比較
      return this.constantTimeEqual(computedHash, storedHash)
    } catch (_error) {
      throw new Error('Invalid hash format')
    }
  }

  private async pbkdf2(
    password: Uint8Array, 
    salt: Uint8Array, 
    iterations: number
  ): Promise<ArrayBuffer> {
    // Web Crypto APIでPBKDF2-SHA256を実行
    const key = await crypto.subtle.importKey(
      'raw',
      password,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    )

    return await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: 'SHA-256'
      },
      key,
      PasswordUtils.HASH_LENGTH * 8 // ビット単位
    )
  }

  private uint8ArrayToBase64(uint8Array: Uint8Array): string {
    // Uint8ArrayをBase64に変換
    const binaryString = String.fromCharCode(...uint8Array)
    return btoa(binaryString)
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    // Base64をUint8Arrayに変換
    const binaryString = atob(base64)
    const uint8Array = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      uint8Array[i] = binaryString.charCodeAt(i)
    }
    return uint8Array
  }

  private constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
    // 定数時間比較でタイミング攻撃を防ぐ
    if (a.length !== b.length) {
      return false
    }

    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i]
    }
    return result === 0
  }
}