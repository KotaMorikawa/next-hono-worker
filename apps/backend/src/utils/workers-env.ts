// Cloudflare Workers環境ユーティリティ

export interface WorkersEnv {
  CACHE: KVNamespace;
  STORAGE: R2Bucket;
  HYPERDRIVE: Hyperdrive;
  NODE_ENV: string;
  JWT_SECRET: string;
  X402_WALLET_ADDRESS: string;
  FRONTEND_URL: string;
}

// KVネームスペースの取得
export function getKVNamespace(): KVNamespace {
  // 実際のWorkers環境では env.CACHE を使用
  // テスト環境ではモックを返す
  if (
    typeof globalThis !== "undefined" &&
    (globalThis as { CACHE?: KVNamespace }).CACHE
  ) {
    return (globalThis as unknown as { CACHE: KVNamespace }).CACHE;
  }

  // テスト環境用のモック
  return {
    get: async () => null,
    put: async () => undefined,
    delete: async () => undefined,
    list: async () => ({ keys: [] }),
  } as unknown as KVNamespace;
}

// R2バケットの取得
export function getR2Bucket(): R2Bucket {
  if (
    typeof globalThis !== "undefined" &&
    (globalThis as { STORAGE?: R2Bucket }).STORAGE
  ) {
    return (globalThis as unknown as { STORAGE: R2Bucket }).STORAGE;
  }

  // テスト環境用のモック
  return {
    put: async () => ({}),
    get: async () => null,
    delete: async () => undefined,
    list: async () => ({ objects: [] }),
  } as unknown as R2Bucket;
}

// Hyperdrive接続の取得
export function getHyperdrive(): Hyperdrive | undefined {
  if (
    typeof globalThis !== "undefined" &&
    (globalThis as { HYPERDRIVE?: Hyperdrive }).HYPERDRIVE
  ) {
    return (globalThis as unknown as { HYPERDRIVE: Hyperdrive }).HYPERDRIVE;
  }
  return undefined;
}

// 環境変数の取得
export function getEnvVar(key: keyof WorkersEnv): string | undefined {
  if (
    typeof globalThis !== "undefined" &&
    (globalThis as Record<string, unknown>)[key]
  ) {
    const value = (globalThis as Record<string, unknown>)[key];
    // 文字列の環境変数のみ返す
    if (typeof value === "string") {
      return value;
    }
  }

  // フォールバック値
  const fallbacks: Record<string, string> = {
    NODE_ENV: "development",
    JWT_SECRET: "dev-secret-key-change-in-production",
    X402_WALLET_ADDRESS: "0x1234567890123456789012345678901234567890",
    FRONTEND_URL: "http://localhost:3000",
  };

  return fallbacks[key];
}

// Workers環境の検証
export function isWorkersEnvironment(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    "caches" in globalThis &&
    "crypto" in globalThis &&
    typeof (globalThis as unknown as { fetch?: () => unknown }).fetch ===
      "function"
  );
}

// KVキーの生成ヘルパー
export const KVKeys = {
  dynamicRoute: (userId: string, apiId: string, version: number) =>
    `api:${userId}:${apiId}:${version}`,

  userRoutes: (userId: string) => `api:${userId}:`,

  routeMetadata: (userId: string, apiId: string) => `meta:${userId}:${apiId}`,

  deploymentInfo: (deploymentId: string) => `deploy:${deploymentId}`,

  systemHealth: () => "system:health",

  routeStats: (userId: string, apiId: string) => `stats:${userId}:${apiId}`,
} as const;

// KV操作のヘルパー
export class KVHelper {
  private kv: KVNamespace;

  constructor(kv?: KVNamespace) {
    this.kv = kv || getKVNamespace();
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const value = await this.kv.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error("KV get error:", error);
      return null;
    }
  }

  async put<T = unknown>(
    key: string,
    value: T,
    options?: { expirationTtl?: number; metadata?: Record<string, unknown> },
  ): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      await this.kv.put(key, serialized, options);
      return true;
    } catch (error) {
      console.error("KV put error:", error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await this.kv.delete(key);
      return true;
    } catch (error) {
      console.error("KV delete error:", error);
      return false;
    }
  }

  async list(options?: { prefix?: string; limit?: number }): Promise<string[]> {
    try {
      const result = await this.kv.list(options);
      return result.keys.map((key: { name: string }) => key.name);
    } catch (error) {
      console.error("KV list error:", error);
      return [];
    }
  }

  async exists(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }
}
