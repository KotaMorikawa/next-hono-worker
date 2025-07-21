// Type definitions for Cloudflare Workers and Hyperdrive integration

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "./schema";

// Database types
export type Database = PostgresJsDatabase<typeof schema>;

// Cloudflare Workers environment types
export interface CloudflareEnv {
  DATABASE_URL?: string;
  HYPERDRIVE_URL?: string;
  HYPERDRIVE?: Hyperdrive;
}

export interface Hyperdrive {
  connectionString: string;
}

// Connection options for different environments
export interface ConnectionOptions {
  maxConnections?: number;
  idleTimeout?: number;
  connectTimeout?: number;
  ssl?: {
    rejectUnauthorized?: boolean;
  };
}

// Workers-specific connection options
export interface WorkersConnectionOptions extends ConnectionOptions {
  hyperdrive?: Hyperdrive;
  env?: CloudflareEnv;
}

// Database operation result types
export interface DatabaseOperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  duration?: number;
}

// Migration status
export interface MigrationStatus {
  applied: boolean;
  version: string;
  appliedAt?: Date;
}

// Health check result
export interface DatabaseHealthCheck {
  healthy: boolean;
  latency?: number;
  error?: string;
  connectionCount?: number;
}

// Query metrics for monitoring
export interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}

// Re-export types from @repo/shared as the single source of truth
export type {
  ApiKey,
  BillingRecord,
  GeneratedApiSpec as GeneratedApi,
  LearningProgress,
  Organization,
  Tutorial,
  UsageStats as ApiUsage,
  User,
} from "@repo/shared";
// Export database-specific types for internal operations
export type {
  ApiKeyDB,
  ApiUsageDB,
  BillingRecordDB,
  GeneratedApiDB,
  LearningProgressDB,
  NewApiKeyDB,
  NewApiUsageDB,
  NewBillingRecordDB,
  NewGeneratedApiDB,
  NewLearningProgressDB,
  NewOrganizationDB,
  NewPaymentRequestDB,
  NewSimulationActionDB,
  NewSimulationDB,
  NewTutorialDB,
  NewUserDB,
  OrganizationDB,
  PaymentRequestDB,
  SimulationActionDB,
  SimulationDB,
  TutorialDB,
  UserDB,
} from "./schema";
