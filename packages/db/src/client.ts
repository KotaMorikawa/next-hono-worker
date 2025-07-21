// =============================================================================
// DATABASE CLIENT FACTORY - 統一データベース接続クライアント
// =============================================================================

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { createDatabaseConnection } from "./index";
import * as schema from "./schema";
import {
  ConnectionPoolManager,
  DatabaseHealthChecker,
} from "./utils/connection-pool";

/**
 * データベースクライアント型定義
 */
export type Database = PostgresJsDatabase<typeof schema>;

/**
 * 接続オプション
 */
export interface DatabaseOptions {
  /** Cloudflare Workers環境フラグ */
  isWorkers?: boolean;
  /** 最大接続数 */
  maxConnections?: number;
  /** アイドルタイムアウト（秒） */
  idleTimeout?: number;
  /** 接続タイムアウト（秒） */
  connectTimeout?: number;
}

/**
 * データベース接続結果
 */
export interface DatabaseConnection {
  /** Drizzle ORMデータベースインスタンス */
  db: Database;
  /** PostgreSQL接続インスタンス */
  sql: import("postgres").Sql;
  /** 接続プールマネージャー */
  poolManager?: ConnectionPoolManager;
  /** ヘルスチェッカー */
  healthChecker?: DatabaseHealthChecker;
}

/**
 * 統一データベースクライアントファクトリー
 *
 * 環境に応じて最適な接続設定を自動選択:
 * - Cloudflare Workers: Hyperdrive最適化設定
 * - 開発環境: ローカルPostgreSQL設定
 *
 * @param databaseUrl - データベースURL (省略時は環境変数から自動取得)
 * @param options - 接続オプション
 * @returns 型安全なデータベース接続
 *
 * @example
 * ```typescript
 * // 基本的な使用
 * const { db } = await createClient();
 *
 * // Workers環境での使用
 * const { db } = await createClient(undefined, {
 *   isWorkers: true,
 *   maxConnections: 1
 * });
 *
 * // カスタム設定
 * const { db } = await createClient('postgresql://...', {
 *   maxConnections: 5,
 *   idleTimeout: 30
 * });
 * ```
 */
export async function createClient(
  databaseUrl?: string,
  options?: DatabaseOptions,
): Promise<DatabaseConnection> {
  const connectionOptions: {
    isWorkers?: boolean;
    maxConnections?: number;
    idleTimeout?: number;
  } = {};

  if (options?.isWorkers !== undefined) {
    connectionOptions.isWorkers = options.isWorkers;
  }
  if (options?.maxConnections !== undefined) {
    connectionOptions.maxConnections = options.maxConnections;
  }
  if (options?.idleTimeout !== undefined) {
    connectionOptions.idleTimeout = options.idleTimeout;
  }

  const { db, sql } = await createDatabaseConnection(
    databaseUrl,
    connectionOptions,
  );

  // 接続プールマネージャーとヘルスチェッカーを初期化
  const poolManager = new ConnectionPoolManager(options?.maxConnections || 10);
  const typedDb = db as unknown as Database;
  const healthChecker = new DatabaseHealthChecker(typedDb);

  return {
    db: typedDb,
    sql,
    poolManager,
    healthChecker,
  };
}

/**
 * シングルトンデータベースクライアント
 *
 * アプリケーション全体で単一のデータベース接続を共有
 * パフォーマンス最適化とリソース管理を提供
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Singleton pattern requires static-only class
class DatabaseSingleton {
  private static instance: DatabaseConnection | null = null;
  private static promise: Promise<DatabaseConnection> | null = null;

  /**
   * シングルトンインスタンス取得
   */
  static async getInstance(
    databaseUrl?: string,
    options?: DatabaseOptions,
  ): Promise<DatabaseConnection> {
    if (DatabaseSingleton.instance) {
      return DatabaseSingleton.instance;
    }

    if (DatabaseSingleton.promise) {
      return DatabaseSingleton.promise;
    }

    DatabaseSingleton.promise = createClient(databaseUrl, options);
    DatabaseSingleton.instance = await DatabaseSingleton.promise;
    DatabaseSingleton.promise = null;

    return DatabaseSingleton.instance;
  }

  /**
   * 接続リセット（テスト用）
   */
  static reset(): void {
    if (DatabaseSingleton.instance?.sql) {
      // Graceful shutdown
      DatabaseSingleton.instance.sql.end({ timeout: 5 });
    }
    DatabaseSingleton.instance = null;
    DatabaseSingleton.promise = null;
  }
}

/**
 * グローバルデータベースクライアント取得
 *
 * アプリケーション全体で共有されるシングルトンクライアント
 *
 * @param databaseUrl - データベースURL
 * @param options - 接続オプション
 * @returns シングルトンデータベース接続
 *
 * @example
 * ```typescript
 * // どこからでも同じ接続インスタンスを取得
 * const { db } = await getDatabase();
 *
 * // ユーザー操作
 * const userOps = new UserOperations(db);
 * const result = await userOps.findById('user-id');
 * ```
 */
export async function getDatabase(
  databaseUrl?: string,
  options?: DatabaseOptions,
): Promise<DatabaseConnection> {
  return DatabaseSingleton.getInstance(databaseUrl, options);
}

/**
 * データベース接続終了
 *
 * アプリケーション終了時やテスト後のクリーンアップ用
 *
 * @example
 * ```typescript
 * // アプリケーション終了時
 * await closeDatabase();
 *
 * // テスト後のクリーンアップ
 * afterAll(async () => {
 *   await closeDatabase();
 * });
 * ```
 */
export async function closeDatabase(): Promise<void> {
  DatabaseSingleton.reset();
}

/**
 * 接続ヘルスチェック
 *
 * データベース接続の健全性を確認
 *
 * @param db - データベースインスタンス
 * @returns 接続健全性
 */
export async function healthCheck(db: Database): Promise<boolean> {
  try {
    await db.select().from(schema.users).limit(1);
    return true;
  } catch {
    // Database health check failed - silently return false
    return false;
  }
}

/**
 * 開発環境用ヘルパー
 */
export const dev = {
  /**
   * 開発用データベース接続
   */
  async connect(): Promise<DatabaseConnection> {
    return createClient(
      "postgresql://x402_user:x402_password@localhost:5432/x402_learning_lab",
      { maxConnections: 10, idleTimeout: 30 },
    );
  },

  /**
   * テスト用データベース接続
   */
  async connectTest(): Promise<DatabaseConnection> {
    return createClient(
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for env vars
      process.env["TEST_DATABASE_URL"] ||
        "postgresql://x402_user:x402_password@localhost:5432/x402_test",
      { maxConnections: 5, idleTimeout: 10 },
    );
  },
};

/**
 * 本番環境用ヘルパー
 */
export const prod = {
  /**
   * Hyperdrive最適化接続
   */
  async connect(hyperdriveUrl?: string): Promise<DatabaseConnection> {
    return createClient(
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for env vars
      hyperdriveUrl || process.env["HYPERDRIVE_URL"],
      {
        isWorkers: true,
        maxConnections: 1,
        idleTimeout: 20,
      },
    );
  },
};
