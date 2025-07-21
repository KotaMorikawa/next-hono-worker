// エラーハンドリング・モニタリング用の型定義

export interface AppError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
  timestamp: string;
  requestId: string;
  userId?: string;
  cause?: Error;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  requestId: string;
  userId?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  responseTime?: number;
  metadata?: Record<string, unknown>;
}

export interface ApiMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: string;
  userId?: string;
  userAgent?: string;
  ipAddress?: string;
  errorCode?: string;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: 'up' | 'down';
    kv: 'up' | 'down';
    r2: 'up' | 'down';
    llm: 'up' | 'down';
  };
  metrics: {
    uptime: number;
    memory: number;
    responseTime: number;
  };
}

export interface RateLimitConfig {
  windowMs: number;        // 時間ウィンドウ（ミリ秒）
  maxRequests: number;     // 最大リクエスト数
  keyGenerator?: (req: { ip?: string; userId?: string; endpoint: string }) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  headers?: boolean;       // X-RateLimit-* ヘッダーを含めるか
  message?: string;        // カスタムエラーメッセージ
}

export interface RateLimitEntry {
  count: number;
  resetTime: number;
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;     // 次回リクエスト可能までの秒数
}

export interface RateLimitOptions {
  global?: RateLimitConfig;
  perEndpoint?: Record<string, RateLimitConfig>;
  perUser?: RateLimitConfig;
  perIP?: RateLimitConfig;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export enum ErrorCodes {
  // Authentication Errors (AUTH_xxx)
  AUTH_INVALID_TOKEN = 'AUTH_INVALID_TOKEN',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_INSUFFICIENT_PERMISSIONS = 'AUTH_INSUFFICIENT_PERMISSIONS',
  AUTH_USER_NOT_FOUND = 'AUTH_USER_NOT_FOUND',
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',

  // Validation Errors (VALIDATION_xxx)
  VALIDATION_INVALID_INPUT = 'VALIDATION_INVALID_INPUT',
  VALIDATION_MISSING_FIELD = 'VALIDATION_MISSING_FIELD',
  VALIDATION_INVALID_FORMAT = 'VALIDATION_INVALID_FORMAT',

  // API Generation Errors (API_xxx)
  API_GENERATION_FAILED = 'API_GENERATION_FAILED',
  API_COMPILATION_ERROR = 'API_COMPILATION_ERROR',
  API_DEPLOYMENT_FAILED = 'API_DEPLOYMENT_FAILED',
  API_INVALID_CODE = 'API_INVALID_CODE',

  // Rate Limiting Errors (RATE_xxx)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  RATE_LIMIT_QUOTA_EXCEEDED = 'RATE_LIMIT_QUOTA_EXCEEDED',

  // System Errors (SYSTEM_xxx)
  SYSTEM_DATABASE_ERROR = 'SYSTEM_DATABASE_ERROR',
  SYSTEM_KV_ERROR = 'SYSTEM_KV_ERROR',
  SYSTEM_R2_ERROR = 'SYSTEM_R2_ERROR',
  SYSTEM_LLM_ERROR = 'SYSTEM_LLM_ERROR',
  SYSTEM_TIMEOUT = 'SYSTEM_TIMEOUT',
  SYSTEM_MEMORY_LIMIT = 'SYSTEM_MEMORY_LIMIT',

  // Business Logic Errors (BUSINESS_xxx)
  BUSINESS_DUPLICATE_RESOURCE = 'BUSINESS_DUPLICATE_RESOURCE',
  BUSINESS_RESOURCE_NOT_FOUND = 'BUSINESS_RESOURCE_NOT_FOUND',
  BUSINESS_OPERATION_FAILED = 'BUSINESS_OPERATION_FAILED',
  BUSINESS_INVALID_STATE = 'BUSINESS_INVALID_STATE',

  // External Service Errors (EXTERNAL_xxx)
  EXTERNAL_SERVICE_UNAVAILABLE = 'EXTERNAL_SERVICE_UNAVAILABLE',
  EXTERNAL_API_RATE_LIMITED = 'EXTERNAL_API_RATE_LIMITED',
  EXTERNAL_AUTHENTICATION_FAILED = 'EXTERNAL_AUTHENTICATION_FAILED',

  // Generic Errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}