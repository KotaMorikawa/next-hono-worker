import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppError } from "../types/monitoring";
import { ErrorCodes } from "../types/monitoring";
import { logger, createRequestLogger } from "../utils/logger";

export class ApplicationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string = ErrorCodes.UNKNOWN_ERROR,
    statusCode: number = 500,
    details?: Record<string, unknown>,
    isOperational: boolean = true,
  ) {
    super(message);
    this.name = "ApplicationError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
  }

  public toAppError(requestId: string, userId?: string): AppError {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: new Date().toISOString(),
      requestId,
      userId,
      cause: this,
    };
  }
}

// Pre-defined error classes for common scenarios
export class ValidationError extends ApplicationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCodes.VALIDATION_INVALID_INPUT, 400, details);
  }
}

export class AuthenticationError extends ApplicationError {
  constructor(message: string, code: string = ErrorCodes.AUTH_INVALID_TOKEN) {
    super(message, code, 401);
  }
}

export class AuthorizationError extends ApplicationError {
  constructor(message: string) {
    super(message, ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS, 403);
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message: string) {
    super(message, ErrorCodes.BUSINESS_RESOURCE_NOT_FOUND, 404);
  }
}

export class ConflictError extends ApplicationError {
  constructor(message: string) {
    super(message, ErrorCodes.BUSINESS_DUPLICATE_RESOURCE, 409);
  }
}

export class RateLimitError extends ApplicationError {
  constructor(message: string) {
    super(message, ErrorCodes.RATE_LIMIT_EXCEEDED, 429);
  }
}

export class SystemError extends ApplicationError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, 500, details, false);
  }
}

/**
 * エラー分類とAppError変換
 */
export function classifyError(error: unknown, requestId: string, userId?: string): AppError {
  const timestamp = new Date().toISOString();

  // ApplicationError（独自エラー）
  if (error instanceof ApplicationError) {
    return error.toAppError(requestId, userId);
  }

  // HTTPException（Hono）
  if (error instanceof HTTPException) {
    return {
      code: `HTTP_${error.status}`,
      message: error.message || "HTTP Error",
      statusCode: error.status,
      timestamp,
      requestId,
      userId,
    };
  }

  // 標準Error
  if (error instanceof Error) {
    // 特定のエラーメッセージパターンから分類
    if (error.message.includes("JWT")) {
      return {
        code: ErrorCodes.AUTH_INVALID_TOKEN,
        message: "Invalid or expired JWT token",
        statusCode: 401,
        timestamp,
        requestId,
        userId,
        cause: error,
      };
    }

    if (error.message.includes("validation")) {
      return {
        code: ErrorCodes.VALIDATION_INVALID_INPUT,
        message: error.message,
        statusCode: 400,
        timestamp,
        requestId,
        userId,
        cause: error,
      };
    }

    if (error.message.includes("timeout")) {
      return {
        code: ErrorCodes.SYSTEM_TIMEOUT,
        message: "Request timeout",
        statusCode: 504,
        timestamp,
        requestId,
        userId,
        cause: error,
      };
    }

    // 一般的なエラー
    return {
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
      message: error.message,
      statusCode: 500,
      timestamp,
      requestId,
      userId,
      cause: error,
    };
  }

  // 未知のエラー
  return {
    code: ErrorCodes.UNKNOWN_ERROR,
    message: "An unknown error occurred",
    statusCode: 500,
    details: { originalError: String(error) },
    timestamp,
    requestId,
    userId,
  };
}

/**
 * エラーレスポンス形式の標準化
 */
export function formatErrorResponse(appError: AppError, includeDetails: boolean = false) {
  const baseResponse = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      timestamp: appError.timestamp,
      requestId: appError.requestId,
    },
  };

  // 開発環境では詳細情報を含める
  if (includeDetails && appError.details) {
    return {
      ...baseResponse,
      error: {
        ...baseResponse.error,
        details: appError.details,
      },
    };
  }

  return baseResponse;
}

/**
 * グローバルエラーハンドリングミドルウェア
 */
export function errorHandler() {
  return async (c: Context, next: Next) => {
    const requestId = c.get("requestId") || crypto.randomUUID();
    const user = c.get("user");
    const userId = user?.userId;
    const requestLogger = createRequestLogger(requestId, userId);

    try {
      // リクエスト開始ログ
      await requestLogger.info("Request started", {
        endpoint: c.req.url,
        method: c.req.method,
        userAgent: c.req.header("User-Agent"),
      });

      await next();

      // 正常終了ログ
      await requestLogger.info("Request completed", {
        endpoint: c.req.url,
        method: c.req.method,
        statusCode: c.res.status,
      });
      
      return;
      
    } catch (error) {
      // エラー分類
      const appError = classifyError(error, requestId, userId);

      // デバッグログ追加
      console.log("ERROR DEBUG:", {
        error: error instanceof Error ? error.constructor.name : typeof error,
        appErrorCode: appError.code,
        appErrorStatusCode: appError.statusCode,
        isApplicationError: error instanceof ApplicationError,
        isRateLimitError: error instanceof RateLimitError,
      });

      // エラーログ出力
      await requestLogger.error("Request failed", {
        endpoint: c.req.url,
        method: c.req.method,
        statusCode: appError.statusCode,
        errorCode: appError.code,
        errorMessage: appError.message,
        metadata: {
          details: appError.details,
          stack: appError.cause instanceof Error ? appError.cause.stack : undefined,
        },
      });

      // 環境に応じた詳細情報の制御
      const includeDetails = process.env.NODE_ENV !== "production";
      const errorResponse = formatErrorResponse(appError, includeDetails);

      // エラーレスポンス返却
      return c.json(errorResponse, appError.statusCode as 200 | 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503 | 504);
    }
  };
}

/**
 * 非同期処理用エラーハンドラー
 */
export async function handleAsyncError<T>(
  operation: () => Promise<T>,
  requestId?: string,
  userId?: string,
): Promise<{ success: true; data: T } | { success: false; error: AppError }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const appError = classifyError(error, requestId || crypto.randomUUID(), userId);
    
    // ログ出力
    await logger.error("Async operation failed", {
      requestId: appError.requestId,
      userId: appError.userId,
      metadata: {
        errorCode: appError.code,
        errorMessage: appError.message,
        details: appError.details,
      },
    });

    return { success: false, error: appError };
  }
}