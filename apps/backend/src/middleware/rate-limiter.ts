import type { Context, Next } from "hono";
import type { RateLimitOptions } from "../types/monitoring";
import { rateLimiter } from "../utils/rate-limiter";
import { RateLimitError } from "./error-handler";
import { logger } from "../utils/logger";

/**
 * レート制限ミドルウェア設定のデフォルト値
 */
const DEFAULT_RATE_LIMIT_OPTIONS: RateLimitOptions = {
  global: {
    windowMs: 15 * 60 * 1000, // 15分
    maxRequests: 1000,        // 1000リクエスト/15分
    headers: true,
    message: "Too many requests from this IP, please try again later.",
  },
  perIP: {
    windowMs: 15 * 60 * 1000, // 15分
    maxRequests: 100,         // 100リクエスト/15分
    headers: true,
  },
  perUser: {
    windowMs: 15 * 60 * 1000, // 15分
    maxRequests: 500,         // 500リクエスト/15分（認証ユーザーは多め）
    headers: true,
  },
  perEndpoint: {
    // API生成は厳しく制限
    "POST /internal/generator/create": {
      windowMs: 60 * 60 * 1000, // 1時間
      maxRequests: 10,          // 10リクエスト/1時間
      headers: true,
      message: "API generation limit exceeded. Please try again later.",
    },
    // 認証エンドポイントも制限
    "POST /internal/auth/login": {
      windowMs: 15 * 60 * 1000, // 15分
      maxRequests: 5,           // 5回まで（ブルートフォース対策）
      headers: true,
      message: "Too many login attempts. Please try again later.",
    },
    "POST /internal/auth/register": {
      windowMs: 60 * 60 * 1000, // 1時間
      maxRequests: 3,           // 3回まで
      headers: true,
      message: "Too many registration attempts. Please try again later.",
    },
  },
};

/**
 * レート制限ミドルウェア
 */
export function rateLimitMiddleware(
  customOptions?: Partial<RateLimitOptions>
) {
  const options: RateLimitOptions = mergeOptions(DEFAULT_RATE_LIMIT_OPTIONS, customOptions);

  // デバッグログ追加
  console.log("RATE LIMIT OPTIONS:", {
    customGlobal: customOptions?.global,
    mergedGlobal: options.global,
    customPerIP: customOptions?.perIP,
    mergedPerIP: options.perIP,
  });

  return async (c: Context, next: Next) => {
    const requestId = c.get("requestId") || crypto.randomUUID();
    const user = c.get("user");
    const userId = user?.userId;
    
    const req = buildRequestInfo(c, userId);

    try {
      const { allowed, result, rule } = await rateLimiter.checkMultipleRateLimits(req, options);

      setRateLimitHeaders(c, options, rule, result);

      if (!allowed) {
        await handleRateLimitExceeded(requestId, userId, req, rule, result, options);
        throw new RateLimitError(getConfigForRule(options, rule)?.message || "Rate limit exceeded");
      }

      await handleRateLimitWarning(requestId, userId, req, rule, result);
      await next();
      
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }
      await handleMiddlewareError(requestId, error, req);
      await next();
    }
  };
}

/**
 * リクエスト情報を構築
 */
function buildRequestInfo(c: Context, userId?: string) {
  return {
    ip: c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "unknown",
    userId,
    endpoint: new URL(c.req.url).pathname,
    method: c.req.method,
  };
}

/**
 * レート制限ヘッダーを設定
 */
function setRateLimitHeaders(
  c: Context, 
  options: RateLimitOptions, 
  rule: string, 
  result: { remaining: number; resetTime: number; retryAfter?: number }
) {
  if (shouldIncludeHeaders(options, rule)) {
    const config = getConfigForRule(options, rule);
    const maxRequests = config?.maxRequests || 100;
    
    c.res.headers.set("X-RateLimit-Limit", maxRequests.toString());
    c.res.headers.set("X-RateLimit-Remaining", result.remaining.toString());
    c.res.headers.set("X-RateLimit-Reset", result.resetTime.toString());
    
    if (result.retryAfter) {
      c.res.headers.set("Retry-After", result.retryAfter.toString());
    }
  }
}

/**
 * レート制限に達した場合の処理
 */
async function handleRateLimitExceeded(
  requestId: string,
  userId: string | undefined,
  req: { ip: string; endpoint: string; method: string },
  rule: string,
  result: { current: number; resetTime: number },
  options: RateLimitOptions
) {
  const config = getConfigForRule(options, rule);
  
  await logger.warn("Rate limit exceeded", {
    requestId,
    userId,
    metadata: {
      rule,
      endpoint: req.endpoint,
      method: req.method,
      ip: req.ip,
      current: result.current,
      limit: config?.maxRequests,
      resetTime: new Date(result.resetTime).toISOString(),
    },
  });
}

/**
 * レート制限警告処理
 */
async function handleRateLimitWarning(
  requestId: string,
  userId: string | undefined,
  req: { endpoint: string },
  rule: string,
  result: { remaining: number; resetTime: number }
) {
  if (result.remaining < 10) {
    await logger.info("Rate limit warning", {
      requestId,
      userId,
      metadata: {
        rule,
        endpoint: req.endpoint,
        remaining: result.remaining,
        resetTime: new Date(result.resetTime).toISOString(),
      },
    });
  }
}

/**
 * ミドルウェアエラー処理
 */
async function handleMiddlewareError(
  requestId: string,
  error: unknown,
  req: { endpoint: string }
) {
  await logger.error("Rate limit middleware error", {
    requestId,
    metadata: { error, endpoint: req.endpoint },
  });
}

/**
 * 特定のエンドポイントに対する個別レート制限ミドルウェア
 */
export function endpointRateLimit(
  windowMs: number,
  maxRequests: number,
  message?: string
) {
  return rateLimitMiddleware({
    perEndpoint: {
      "*": {
        windowMs,
        maxRequests,
        headers: true,
        message: message || "Rate limit exceeded for this endpoint",
      },
    },
  });
}

/**
 * 認証ユーザー向けレート制限（より緩い制限）
 */
export function authenticatedRateLimit() {
  return rateLimitMiddleware({
    perUser: {
      windowMs: 15 * 60 * 1000, // 15分
      maxRequests: 1000,        // 1000リクエスト/15分
      headers: true,
    },
  });
}

/**
 * 厳しいレート制限（APIキー生成など）
 */
export function strictRateLimit() {
  return rateLimitMiddleware({
    perIP: {
      windowMs: 60 * 60 * 1000, // 1時間
      maxRequests: 5,           // 5リクエスト/1時間
      headers: true,
      message: "Strict rate limit exceeded. Please try again later.",
    },
  });
}

/**
 * オプションをマージする
 */
function mergeOptions(
  defaults: RateLimitOptions,
  custom?: Partial<RateLimitOptions>
): RateLimitOptions {
  if (!custom) return defaults;

  // デバッグログ追加
  console.log("MERGE OPTIONS DEBUG:", {
    hasCustom: !!custom,
    customGlobal: custom.global,
    customGlobalUndefined: custom.global === undefined,
    customGlobalNotUndefined: custom.global !== undefined,
    defaultsGlobal: defaults.global?.maxRequests,
  });

  return {
    global: 'global' in custom ? custom.global : defaults.global,
    perIP: 'perIP' in custom ? custom.perIP : defaults.perIP,
    perUser: 'perUser' in custom ? custom.perUser : defaults.perUser,
    perEndpoint: {
      ...defaults.perEndpoint,
      ...custom.perEndpoint,
    },
  };
}

/**
 * 指定されたルールでヘッダーを含めるかどうかを判断
 */
function shouldIncludeHeaders(options: RateLimitOptions, rule: string): boolean {
  const config = getConfigForRule(options, rule);
  return config?.headers !== false;
}

/**
 * ルールに対応する設定を取得
 */
function getConfigForRule(options: RateLimitOptions, rule: string) {
  if (rule === 'global') return options.global;
  if (rule === 'per-ip') return options.perIP;
  if (rule === 'per-user') return options.perUser;
  if (rule.startsWith('endpoint:')) {
    const endpointRule = rule.replace('endpoint:', '');
    return options.perEndpoint?.[endpointRule];
  }
  return null;
}