// =============================================================================
// CONNECTION POOL MANAGEMENT - 接続プール管理ユーティリティ
// =============================================================================

import type { Database } from "../client";

/**
 * 接続プール統計情報
 */
export interface ConnectionPoolStats {
  /** 現在のアクティブ接続数 */
  activeConnections: number;
  /** アイドル接続数 */
  idleConnections: number;
  /** 最大接続数 */
  maxConnections: number;
  /** 総実行クエリ数 */
  totalQueries: number;
  /** 平均クエリ実行時間（ms） */
  averageQueryTime: number;
  /** 最後のアクティビティ時刻 */
  lastActivity: Date;
}

/**
 * 接続プールマネージャー
 * 
 * パフォーマンス監視と最適化のための接続プール管理
 */
export class ConnectionPoolManager {
  private stats: ConnectionPoolStats;
  private queryTimes: number[] = [];
  private readonly maxQueryTimeHistory = 1000;

  constructor(maxConnections: number = 10) {
    this.stats = {
      activeConnections: 0,
      idleConnections: 0,
      maxConnections,
      totalQueries: 0,
      averageQueryTime: 0,
      lastActivity: new Date(),
    };
  }

  /**
   * クエリ実行の記録
   * 
   * @param executionTime - 実行時間（ms）
   */
  recordQuery(executionTime: number): void {
    this.stats.totalQueries++;
    this.stats.lastActivity = new Date();

    // クエリ時間履歴を管理
    this.queryTimes.push(executionTime);
    if (this.queryTimes.length > this.maxQueryTimeHistory) {
      this.queryTimes.shift();
    }

    // 平均クエリ時間を計算
    this.stats.averageQueryTime = 
      this.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryTimes.length;
  }

  /**
   * アクティブ接続数を更新
   */
  updateActiveConnections(count: number): void {
    this.stats.activeConnections = count;
  }

  /**
   * アイドル接続数を更新
   */
  updateIdleConnections(count: number): void {
    this.stats.idleConnections = count;
  }

  /**
   * 統計情報取得
   */
  getStats(): ConnectionPoolStats {
    return { ...this.stats };
  }

  /**
   * パフォーマンス警告チェック
   */
  getPerformanceWarnings(): string[] {
    const warnings: string[] = [];

    // 接続プール使用率が高い場合
    const usage = this.stats.activeConnections / this.stats.maxConnections;
    if (usage > 0.8) {
      warnings.push(`High connection pool usage: ${Math.round(usage * 100)}%`);
    }

    // 平均クエリ時間が長い場合
    if (this.stats.averageQueryTime > 1000) {
      warnings.push(`Slow average query time: ${Math.round(this.stats.averageQueryTime)}ms`);
    }

    // アイドル接続が多すぎる場合
    if (this.stats.idleConnections > this.stats.maxConnections * 0.5) {
      warnings.push(`Too many idle connections: ${this.stats.idleConnections}`);
    }

    return warnings;
  }

  /**
   * 統計情報リセット
   */
  reset(): void {
    this.stats = {
      activeConnections: 0,
      idleConnections: 0,
      maxConnections: this.stats.maxConnections,
      totalQueries: 0,
      averageQueryTime: 0,
      lastActivity: new Date(),
    };
    this.queryTimes = [];
  }
}

/**
 * クエリ実行時間計測デコレータ
 * 
 * @param poolManager - 接続プールマネージャー
 * @returns デコレータ関数
 */
export function withPerformanceTracking(poolManager: ConnectionPoolManager) {
  return <T extends (...args: unknown[]) => Promise<unknown>>(
    _target: unknown,
    _propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) => {
    const method = descriptor.value as T;

    descriptor.value = (async function (this: unknown, ...args: unknown[]) {
      const startTime = Date.now();
      
      try {
        const result = await method.apply(this, args);
        const executionTime = Date.now() - startTime;
        poolManager.recordQuery(executionTime);
        return result;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        poolManager.recordQuery(executionTime);
        throw error;
      }
    }) as T;

    return descriptor;
  };
}

/**
 * データベース接続ヘルスチェッカー
 */
export class DatabaseHealthChecker {
  private isHealthy = true;
  private lastCheck = new Date();
  private failureCount = 0;
  private readonly maxFailures = 3;

  constructor(private db: Database) {}

  /**
   * ヘルスチェック実行
   */
  async check(): Promise<boolean> {
    try {
      const startTime = Date.now();
      
      // 簡単なクエリで接続確認
      // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed for dynamic table query
      await this.db.select().from({ users: "users" } as any).limit(1);
      
      const responseTime = Date.now() - startTime;
      
      // レスポンス時間が長すぎる場合は警告
      if (responseTime > 5000) {
        // Slow database response detected - consider optimization
      }

      this.isHealthy = true;
      this.failureCount = 0;
      this.lastCheck = new Date();
      
      return true;
    } catch (_error) {
      this.failureCount++;
      this.lastCheck = new Date();
      
      if (this.failureCount >= this.maxFailures) {
        this.isHealthy = false;
        // Database health check failed multiple times - connection issues detected
      }
      
      return false;
    }
  }

  /**
   * 健全性状態取得
   */
  isHealthyStatus(): boolean {
    return this.isHealthy;
  }

  /**
   * 最後のチェック時刻取得
   */
  getLastCheckTime(): Date {
    return this.lastCheck;
  }

  /**
   * 失敗回数取得
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * 状態リセット
   */
  reset(): void {
    this.isHealthy = true;
    this.failureCount = 0;
    this.lastCheck = new Date();
  }
}

/**
 * 接続プール最適化のための推奨設定
 */
export const ConnectionPoolOptimizer = {
  /**
   * Cloudflare Workers用設定
   */
  workers: {
    maxConnections: 1,
    idleTimeout: 20,
    connectTimeout: 10,
    acquireTimeout: 10,
  },

  /**
   * 開発環境用設定
   */
  development: {
    maxConnections: 10,
    idleTimeout: 30,
    connectTimeout: 30,
    acquireTimeout: 30,
  },

  /**
   * 本番環境用設定（通常のNode.js）
   */
  production: {
    maxConnections: 20,
    idleTimeout: 60,
    connectTimeout: 30,
    acquireTimeout: 60,
  },

  /**
   * 高負荷環境用設定
   */
  highLoad: {
    maxConnections: 50,
    idleTimeout: 120,
    connectTimeout: 30,
    acquireTimeout: 30,
  },
};

/**
 * 環境に応じた最適な接続プール設定を取得
 * 
 * @param environment - 環境タイプ
 * @returns 接続プール設定
 */
export function getOptimalPoolConfig(
  environment: 'workers' | 'development' | 'production' | 'high-load' = 'development'
) {
  switch (environment) {
    case 'workers':
      return ConnectionPoolOptimizer.workers;
    case 'development':
      return ConnectionPoolOptimizer.development;
    case 'production':
      return ConnectionPoolOptimizer.production;
    case 'high-load':
      return ConnectionPoolOptimizer.highLoad;
    default:
      return ConnectionPoolOptimizer.development;
  }
}