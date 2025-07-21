import { Hono } from "hono";
import type { HealthCheckResult } from "../types/monitoring";
import { logger } from "../utils/logger";

export const healthRoutes = new Hono();

/**
 * システム稼働時間（プロセス開始からの時間）
 */
const processStartTime = Date.now();

/**
 * ヘルスチェック用の個別サービス検証
 */
class HealthChecker {
  /**
   * データベース接続チェック
   */
  async checkDatabase(hyperdrive?: unknown): Promise<'up' | 'down'> {
    try {
      if (!hyperdrive) return 'down';
      
      // 簡単なクエリで接続確認
      // 実際の環境では適切なクエリを実行
      await Promise.resolve(); // プレースホルダー
      return 'up';
    } catch (error) {
      await logger.error("Database health check failed", { 
        metadata: { error } 
      });
      return 'down';
    }
  }

  /**
   * KVストレージチェック
   */
  async checkKV(kv?: KVNamespace): Promise<'up' | 'down'> {
    try {
      if (!kv) return 'down';
      
      const testKey = `health-check:${Date.now()}`;
      const testValue = "ok";
      
      // テストデータの書き込み・読み込み
      await kv.put(testKey, testValue, { expirationTtl: 60 });
      const result = await kv.get(testKey);
      await kv.delete(testKey);
      
      return result === testValue ? 'up' : 'down';
    } catch (error) {
      await logger.error("KV health check failed", { 
        metadata: { error } 
      });
      return 'down';
    }
  }

  /**
   * R2ストレージチェック
   */
  async checkR2(r2?: unknown): Promise<'up' | 'down'> {
    try {
      if (!r2) return 'down';
      
      // リスト操作で接続確認
      await (r2 as { list: (options: { limit: number }) => Promise<unknown> }).list({ limit: 1 });
      return 'up';
    } catch (error) {
      await logger.error("R2 health check failed", { 
        metadata: { error } 
      });
      return 'down';
    }
  }

  /**
   * LLMサービスチェック（Gemini Pro）
   */
  async checkLLM(): Promise<'up' | 'down'> {
    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey || geminiApiKey === "your-gemini-api-key-here") {
        return 'down';
      }

      // 簡単なテストリクエスト
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${geminiApiKey}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.ok ? 'up' : 'down';
    } catch (error) {
      await logger.error("LLM health check failed", { 
        metadata: { error } 
      });
      return 'down';
    }
  }

  /**
   * システムメトリクス取得
   */
  getSystemMetrics() {
    const uptime = Date.now() - processStartTime;
    
    // Cloudflare Workers環境ではメモリ使用量の詳細取得は制限される
    const memory = 0; // プレースホルダー
    
    return {
      uptime: Math.floor(uptime / 1000), // 秒単位
      memory,
      responseTime: 0, // 後で設定
    };
  }
}

const healthChecker = new HealthChecker();

/**
 * 基本ヘルスチェック
 * GET /health
 */
healthRoutes.get("/", async (c) => {
  const startTime = Date.now();
  
  try {
    const result: HealthCheckResult = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'up', // 簡易版
        kv: 'up',       // 簡易版
        r2: 'up',       // 簡易版
        llm: 'up',      // 簡易版
      },
      metrics: {
        ...healthChecker.getSystemMetrics(),
        responseTime: Date.now() - startTime,
      },
    };

    return c.json(result);
  } catch (error) {
    await logger.error("Health check failed", { 
      metadata: { error } 
    });

    const errorResult: HealthCheckResult = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'down',
        kv: 'down',
        r2: 'down',
        llm: 'down',
      },
      metrics: {
        ...healthChecker.getSystemMetrics(),
        responseTime: Date.now() - startTime,
      },
    };

    return c.json(errorResult, 503);
  }
});

/**
 * 詳細ヘルスチェック
 * GET /health/detailed
 */
healthRoutes.get("/detailed", async (c) => {
  const startTime = Date.now();
  const requestId = c.get("requestId") || crypto.randomUUID();
  
  try {
    // 各サービスの詳細チェック実行
    const env = c.env as Record<string, unknown>;
    const [databaseStatus, kvStatus, r2Status, llmStatus] = await Promise.allSettled([
      healthChecker.checkDatabase(env?.HYPERDRIVE),
      healthChecker.checkKV(env?.CACHE as KVNamespace | undefined),
      healthChecker.checkR2(env?.STORAGE),
      healthChecker.checkLLM(),
    ]);

    const services = {
      database: databaseStatus.status === 'fulfilled' ? databaseStatus.value : 'down',
      kv: kvStatus.status === 'fulfilled' ? kvStatus.value : 'down',
      r2: r2Status.status === 'fulfilled' ? r2Status.value : 'down',
      llm: llmStatus.status === 'fulfilled' ? llmStatus.value : 'down',
    };

    // 全体のステータス判定
    const serviceValues = Object.values(services);
    const downServices = serviceValues.filter(status => status === 'down').length;
    
    let overallStatus: HealthCheckResult['status'];
    if (downServices === 0) {
      overallStatus = 'healthy';
    } else if (downServices < serviceValues.length / 2) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services,
      metrics: {
        ...healthChecker.getSystemMetrics(),
        responseTime: Date.now() - startTime,
      },
    };

    // ログ出力
    await logger.info("Detailed health check completed", {
      requestId: requestId as string,
      metadata: {
        status: overallStatus,
        services,
        responseTime: result.metrics.responseTime,
      },
    });

    const statusCode = overallStatus === 'healthy' ? 200 : 
                       overallStatus === 'degraded' ? 200 : 503;
    
    return c.json(result, statusCode);
    
  } catch (error) {
    await logger.error("Detailed health check failed", { 
      requestId: requestId as string,
      metadata: { error } 
    });

    const errorResult: HealthCheckResult = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'down',
        kv: 'down',
        r2: 'down',
        llm: 'down',
      },
      metrics: {
        ...healthChecker.getSystemMetrics(),
        responseTime: Date.now() - startTime,
      },
    };

    return c.json(errorResult, 503);
  }
});

/**
 * Liveness プローブ（Kubernetes風）
 * GET /health/live
 */
healthRoutes.get("/live", async (c) => {
  // 単純にプロセスが生きているかチェック
  return c.json({
    status: "alive",
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - processStartTime) / 1000),
  });
});

/**
 * Readiness プローブ（Kubernetes風）
 * GET /health/ready
 */
healthRoutes.get("/ready", async (c) => {
  try {
    // 最低限のサービスが利用可能かチェック
    const env = c.env as Record<string, unknown>;
    const kvStatus = await healthChecker.checkKV(env?.CACHE as KVNamespace | undefined);
    
    if (kvStatus === 'up') {
      return c.json({
        status: "ready",
        timestamp: new Date().toISOString(),
      });
    } else {
      return c.json({
        status: "not_ready",
        timestamp: new Date().toISOString(),
        reason: "KV service unavailable",
      }, 503);
    }
  } catch (_error) {
    return c.json({
      status: "not_ready",
      timestamp: new Date().toISOString(),
      reason: "Health check failed",
    }, 503);
  }
});