import type { Context, Next } from "hono";
import type { ApiMetrics } from "../types/monitoring";
import { metricsCollector } from "../utils/metrics-collector";
import { logger } from "../utils/logger";

interface RequestTiming {
  startTime: number;
  endTime?: number;
  responseTime?: number;
}

/**
 * パフォーマンス監視ミドルウェア
 */
export function performanceMonitor() {
  return async (c: Context, next: Next) => {
    const requestId = c.get("requestId") || crypto.randomUUID();
    const user = c.get("user");
    const userId = user?.userId;
    
    // リクエスト ID をコンテキストに設定
    c.set("requestId", requestId);
    
    // 開始時刻記録
    const timing: RequestTiming = {
      startTime: Date.now(),
    };

    try {
      await next();
      
      // 終了時刻と応答時間を記録
      timing.endTime = Date.now();
      timing.responseTime = timing.endTime - timing.startTime;

      // メトリクス記録
      await recordMetrics(c, timing, userId, requestId);
      
      // パフォーマンス警告チェック
      await checkPerformanceThresholds(c, timing, requestId);
      
    } catch (error) {
      // エラー時もメトリクスを記録
      timing.endTime = Date.now();
      timing.responseTime = timing.endTime - timing.startTime;
      
      await recordMetrics(c, timing, userId, requestId, error);
      throw error; // エラーは再スロー
    }
  };
}

/**
 * メトリクス記録
 */
async function recordMetrics(
  c: Context,
  timing: RequestTiming,
  userId?: string,
  requestId?: string,
  error?: unknown,
): Promise<void> {
  try {
    const metric: ApiMetrics = {
      endpoint: new URL(c.req.url).pathname,
      method: c.req.method,
      responseTime: timing.responseTime || 0,
      statusCode: c.res?.status || (error ? 500 : 200),
      timestamp: new Date().toISOString(),
      userId,
      userAgent: c.req.header("User-Agent"),
      ipAddress: c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For"),
      errorCode: error instanceof Error ? error.message : undefined,
    };

    await metricsCollector.recordMetric(metric);
  } catch (metricsError) {
    // メトリクス記録エラーはログのみ
    await logger.error("Failed to record metrics", {
      requestId,
      metadata: { metricsError },
    });
  }
}

/**
 * パフォーマンス閾値チェック
 */
async function checkPerformanceThresholds(
  c: Context,
  timing: RequestTiming,
  requestId: string,
): Promise<void> {
  const responseTime = timing.responseTime || 0;
  const endpoint = new URL(c.req.url).pathname;

  // 警告閾値: 2秒
  const warningThreshold = 2000;
  // 重大閾値: 5秒
  const criticalThreshold = 5000;

  if (responseTime > criticalThreshold) {
    await logger.error("Critical performance issue detected", {
      requestId,
      endpoint,
      method: c.req.method,
      responseTime,
      metadata: {
        threshold: criticalThreshold,
        severity: "critical",
      },
    });
  } else if (responseTime > warningThreshold) {
    await logger.warn("Performance warning detected", {
      requestId,
      endpoint,
      method: c.req.method,
      responseTime,
      metadata: {
        threshold: warningThreshold,
        severity: "warning",
      },
    });
  }
}

/**
 * レスポンス時間をヘッダーに追加するミドルウェア
 */
export function responseTimeHeader() {
  return async (c: Context, next: Next) => {
    const startTime = Date.now();
    
    await next();
    
    const responseTime = Date.now() - startTime;
    c.res.headers.set("X-Response-Time", `${responseTime}ms`);
    return;
  };
}

/**
 * リクエストIDを生成・追加するミドルウェア
 */
export function requestIdMiddleware() {
  return async (c: Context, next: Next) => {
    // 既存のリクエストIDがあれば使用、なければ生成
    const existingRequestId = c.req.header("X-Request-ID");
    const requestId = existingRequestId || crypto.randomUUID();
    
    c.set("requestId", requestId);
    c.res.headers.set("X-Request-ID", requestId);
    
    await next();
    return;
  };
}

/**
 * CORS対応ミドルウェア（パフォーマンス最適化版）
 */
export function corsMiddleware() {
  return async (c: Context, next: Next) => {
    const origin = c.req.header("Origin");
    const allowedOrigins = [
      "http://localhost:3000",
      "https://x402-lab.com",
      "https://x402-lab-staging.pages.dev",
    ];

    // プリフライトリクエストの高速処理
    if (c.req.method === "OPTIONS") {
      c.res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      c.res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID");
      c.res.headers.set("Access-Control-Max-Age", "86400"); // 24時間キャッシュ
      
      if (origin && allowedOrigins.includes(origin)) {
        c.res.headers.set("Access-Control-Allow-Origin", origin);
      }
      
      return new Response("", { status: 204 });
    }

    // 通常のリクエスト処理
    if (origin && allowedOrigins.includes(origin)) {
      c.res.headers.set("Access-Control-Allow-Origin", origin);
    }
    
    c.res.headers.set("Access-Control-Allow-Credentials", "true");
    
    await next();
    return;
  };
}

/**
 * セキュリティヘッダーミドルウェア
 */
export function securityHeaders() {
  return async (c: Context, next: Next) => {
    await next();
    
    // セキュリティヘッダーを設定
    c.res.headers.set("X-Content-Type-Options", "nosniff");
    c.res.headers.set("X-Frame-Options", "DENY");
    c.res.headers.set("X-XSS-Protection", "1; mode=block");
    c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    c.res.headers.set("Content-Security-Policy", "default-src 'self'");
    return;
  };
}