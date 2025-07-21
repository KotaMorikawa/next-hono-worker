import type { 
  RateLimitConfig, 
  RateLimitEntry, 
  RateLimitResult,
  RateLimitOptions 
} from "../types/monitoring";
import { logger } from "./logger";

export class RateLimiter {
  private static instance: RateLimiter | null = null;
  private kvNamespace?: KVNamespace;

  private constructor(kvNamespace?: KVNamespace) {
    this.kvNamespace = kvNamespace;
  }

  public static getInstance(kvNamespace?: KVNamespace): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter(kvNamespace);
    }
    return RateLimiter.instance;
  }

  public static initialize(kvNamespace?: KVNamespace): RateLimiter {
    RateLimiter.instance = new RateLimiter(kvNamespace);
    return RateLimiter.instance;
  }

  /**
   * 既存のインスタンスのKVNamespaceを更新（テスト用）
   */
  public updateKVNamespace(kvNamespace?: KVNamespace): void {
    this.kvNamespace = kvNamespace;
  }

  /**
   * レート制限チェックを実行
   */
  public async checkRateLimit(
    key: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    if (!this.kvNamespace) {
      await logger.warn("KV namespace not available for rate limiting");
      // KVが利用できない場合は制限なしとする
      return {
        allowed: true,
        current: 0,
        remaining: config.maxRequests,
        resetTime: Date.now() + config.windowMs,
      };
    }

    const now = Date.now();
    const resetTime = now + config.windowMs;
    const rateLimitKey = `ratelimit:${key}`;

    try {
      // 現在のレート制限情報を取得
      const currentEntry = await this.getCurrentEntry(rateLimitKey);
      
      // ウィンドウが期限切れかチェック
      if (currentEntry && now >= currentEntry.resetTime) {
        // 期限切れの場合、削除
        await this.kvNamespace.delete(rateLimitKey);
        return this.createNewEntry(rateLimitKey, config, resetTime);
      }

      if (!currentEntry) {
        // 初回リクエストの場合
        return this.createNewEntry(rateLimitKey, config, resetTime);
      }

      // 制限に達しているかチェック
      if (currentEntry.count >= config.maxRequests) {
        const retryAfter = Math.ceil((currentEntry.resetTime - now) / 1000);
        return {
          allowed: false,
          current: currentEntry.count,
          remaining: 0,
          resetTime: currentEntry.resetTime,
          retryAfter,
        };
      }

      // カウントを増加
      const updatedEntry: RateLimitEntry = {
        ...currentEntry,
        count: currentEntry.count + 1,
      };

      await this.kvNamespace.put(
        rateLimitKey, 
        JSON.stringify(updatedEntry),
        { expirationTtl: Math.ceil(config.windowMs / 1000) }
      );

      return {
        allowed: true,
        current: updatedEntry.count,
        remaining: Math.max(0, config.maxRequests - updatedEntry.count),
        resetTime: updatedEntry.resetTime,
      };

    } catch (error) {
      await logger.error("Rate limit check failed", { 
        metadata: { key, error } 
      });
      
      // エラー時は制限なしとする
      return {
        allowed: true,
        current: 0,
        remaining: config.maxRequests,
        resetTime,
      };
    }
  }

  /**
   * 現在のレート制限情報を取得
   */
  private async getCurrentEntry(key: string): Promise<RateLimitEntry | null> {
    if (!this.kvNamespace) return null;

    try {
      const data = await this.kvNamespace.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      await logger.warn("Failed to get rate limit entry", { 
        metadata: { key, error } 
      });
      return null;
    }
  }

  /**
   * 新しいレート制限エントリを作成
   */
  private async createNewEntry(
    key: string,
    config: RateLimitConfig,
    resetTime: number,
  ): Promise<RateLimitResult> {
    if (!this.kvNamespace) {
      return {
        allowed: true,
        current: 1,
        remaining: config.maxRequests - 1,
        resetTime,
      };
    }

    const entry: RateLimitEntry = {
      count: 1,
      resetTime,
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
    };

    try {
      await this.kvNamespace.put(
        key, 
        JSON.stringify(entry),
        { expirationTtl: Math.ceil(config.windowMs / 1000) }
      );

      return {
        allowed: true,
        current: 1,
        remaining: config.maxRequests - 1,
        resetTime,
      };
    } catch (error) {
      await logger.error("Failed to create rate limit entry", { 
        metadata: { key, error } 
      });

      return {
        allowed: true,
        current: 1,
        remaining: config.maxRequests - 1,
        resetTime,
      };
    }
  }

  /**
   * 複数のレート制限ルールをチェック
   */
  public async checkMultipleRateLimits(
    req: { ip?: string; userId?: string; endpoint: string; method: string },
    options: RateLimitOptions,
  ): Promise<{ allowed: boolean; result: RateLimitResult; rule: string }> {
    const checks = this.buildRateLimitChecks(req, options);

    if (checks.length === 0) {
      return this.getDefaultResult();
    }

    return this.processChecks(checks);
  }

  /**
   * レート制限チェックのリストを作成
   */
  private buildRateLimitChecks(
    req: { ip?: string; userId?: string; endpoint: string; method: string },
    options: RateLimitOptions,
  ): Array<{ key: string; config: RateLimitConfig; rule: string }> {
    const checks = [];

    // グローバル制限
    if (options.global) {
      checks.push({
        key: `global:${req.ip || 'unknown'}`,
        config: options.global,
        rule: 'global',
      });
    }

    // IP別制限
    if (options.perIP && req.ip) {
      checks.push({
        key: `ip:${req.ip}`,
        config: options.perIP,
        rule: 'per-ip',
      });
    }

    // ユーザー別制限
    if (options.perUser && req.userId) {
      checks.push({
        key: `user:${req.userId}`,
        config: options.perUser,
        rule: 'per-user',
      });
    }

    // エンドポイント別制限
    if (options.perEndpoint) {
      const endpointKey = `${req.method} ${req.endpoint}`;
      const config = options.perEndpoint[endpointKey] || options.perEndpoint['*'];
      if (config) {
        const key = `endpoint:${endpointKey}:${req.ip || req.userId || 'anonymous'}`;
        checks.push({
          key,
          config,
          rule: `endpoint:${endpointKey}`,
        });
      }
    }

    return checks;
  }

  /**
   * デフォルト結果を取得（制限なし）
   */
  private getDefaultResult(): { allowed: boolean; result: RateLimitResult; rule: string } {
    return {
      allowed: true,
      result: {
        allowed: true,
        current: 0,
        remaining: Number.MAX_SAFE_INTEGER,
        resetTime: Date.now() + 60000,
      },
      rule: 'none',
    };
  }

  /**
   * チェックを処理して結果を返す
   */
  private async processChecks(
    checks: Array<{ key: string; config: RateLimitConfig; rule: string }>
  ): Promise<{ allowed: boolean; result: RateLimitResult; rule: string }> {
    let lastResult: RateLimitResult | null = null;
    
    for (const check of checks) {
      const result = await this.checkRateLimit(check.key, check.config);
      lastResult = result;
      
      if (!result.allowed) {
        return {
          allowed: false,
          result,
          rule: check.rule,
        };
      }
    }

    // すべてのルールを通過した場合
    return {
      allowed: true,
      result: lastResult || {
        allowed: true,
        current: 1,
        remaining: Math.min(...checks.map(c => c.config.maxRequests)) - 1,
        resetTime: Date.now() + Math.min(...checks.map(c => c.config.windowMs)),
      },
      rule: checks[0].rule,
    };
  }

  /**
   * 特定のキーのレート制限をリセット
   */
  public async resetRateLimit(key: string): Promise<void> {
    if (!this.kvNamespace) return;

    try {
      await this.kvNamespace.delete(`ratelimit:${key}`);
      await logger.info("Rate limit reset", { metadata: { key } });
    } catch (error) {
      await logger.error("Failed to reset rate limit", { 
        metadata: { key, error } 
      });
    }
  }

  /**
   * レート制限統計を取得
   */
  public async getRateLimitStats(
    keyPattern?: string
  ): Promise<Array<{ key: string; entry: RateLimitEntry }>> {
    if (!this.kvNamespace) return [];

    try {
      const prefix = keyPattern ? `ratelimit:${keyPattern}` : 'ratelimit:';
      const result = await this.kvNamespace.list({ prefix, limit: 1000 });
      
      const stats = [];
      for (const key of result.keys) {
        const data = await this.kvNamespace.get(key.name);
        if (data) {
          stats.push({
            key: key.name.replace('ratelimit:', ''),
            entry: JSON.parse(data),
          });
        }
      }

      return stats;
    } catch (error) {
      await logger.error("Failed to get rate limit stats", { 
        metadata: { keyPattern, error } 
      });
      return [];
    }
  }
}

// シングルトンインスタンスのエクスポート
export const rateLimiter = RateLimiter.getInstance();