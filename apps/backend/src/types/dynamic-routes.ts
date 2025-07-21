// 動的ルート管理に関する型定義

export interface DynamicRouteEntry {
  code: string;
  metadata: DynamicRouteMetadata;
}

export interface DynamicRouteMetadata {
  endpoint: string;
  method: string;
  status: "active" | "inactive" | "draft";
  createdAt: string;
  version: number;
  userId: string;
  apiId: string;
}

export interface DynamicRouteResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CodeValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface SandboxExecutionOptions {
  timeout?: number; // ミリ秒
  memoryLimit?: number; // バイト
  maxConcurrency?: number; // 同時実行制限
}

export interface SandboxExecutionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  executionTime?: number;
  memoryUsed?: number;
}

export interface DeploymentInfo {
  deploymentId: string;
  status: "deployed" | "undeployed" | "error" | "rolled_back";
  endpoint: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    hasPayment?: boolean;
    paymentConfig?: {
      price: string;
      walletAddress: string;
    };
  };
}

export interface CompiledRoute {
  success: boolean;
  data?: object; // Honoアプリインスタンス
  error?: string;
  metadata?: {
    hasPayment: boolean;
    paymentConfig?: {
      price: string;
      walletAddress: string;
    };
    endpoints: Array<{
      path: string;
      method: string;
    }>;
  };
}

// Workers KV関連の型
export interface KVStorageOperation {
  key: string;
  value?: string;
  metadata?: Record<string, unknown>;
  expirationTtl?: number;
}

export interface RouteRegistryStats {
  totalRoutes: number;
  activeRoutes: number;
  inactiveRoutes: number;
  totalVersions: number;
  storageUsed: number; // バイト
  lastUpdated: string;
}

// セキュリティ関連の型
export interface SecurityPolicy {
  allowedImports: string[];
  forbiddenFunctions: string[];
  maxCodeLength: number;
  maxExecutionTime: number;
  maxMemoryUsage: number;
  allowFileSystem: boolean;
  allowNetwork: boolean;
}

export interface ResourceLimits {
  cpu: {
    maxExecutionTime: number; // ミリ秒
    maxInstructions?: number;
  };
  memory: {
    maxHeapSize: number; // バイト
    maxStackSize?: number; // バイト
  };
  concurrency: {
    maxConcurrentExecutions: number;
    queueTimeout: number; // ミリ秒
  };
}

// バージョニング関連の型
export interface VersionInfo {
  version: number;
  createdAt: string;
  description?: string;
  changelog?: string;
  isActive: boolean;
  rollbackAvailable: boolean;
}

export interface RollbackOperation {
  fromVersion: number;
  toVersion: number;
  reason?: string;
  timestamp: string;
  userId: string;
}

// エラー処理関連の型
export interface DynamicRouteError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  userId?: string;
  apiId?: string;
  version?: number;
}

export const DYNAMIC_ROUTE_ERRORS = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  SANDBOX_ERROR: "SANDBOX_ERROR",
  KV_STORAGE_ERROR: "KV_STORAGE_ERROR",
  DEPLOYMENT_FAILED: "DEPLOYMENT_FAILED",
  ROUTE_CONFLICT: "ROUTE_CONFLICT",
  VERSION_NOT_FOUND: "VERSION_NOT_FOUND",
  UNAUTHORIZED_ACCESS: "UNAUTHORIZED_ACCESS",
  RESOURCE_LIMIT_EXCEEDED: "RESOURCE_LIMIT_EXCEEDED",
} as const;

export type DynamicRouteErrorCode =
  (typeof DYNAMIC_ROUTE_ERRORS)[keyof typeof DYNAMIC_ROUTE_ERRORS];

// 監視・統計関連の型
export interface RouteMetrics {
  deploymentId: string;
  endpoint: string;
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  lastAccessed: string;
  totalRevenue: string; // USDC amount
}

export interface SystemHealth {
  kvAvailable: boolean;
  sandboxAvailable: boolean;
  routeRegistryHealth: "healthy" | "degraded" | "error";
  activeDeployments: number;
  queuedDeployments: number;
  systemLoad: number;
  lastCheckTimestamp: string;
}
