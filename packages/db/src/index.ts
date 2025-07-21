// =============================================================================
// DATABASE PACKAGE - MAIN EXPORTS
// =============================================================================

// Convenience exports for common operations
export {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lte,
  notInArray,
  sql,
} from "drizzle-orm";
export type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
// Database connection utilities
export { drizzle } from "drizzle-orm/postgres-js";
// Database client and connection utilities
export * from "./client";
export * from "./migrations";
export * from "./operations";
export * from "./schema";
export type { Database } from "./types";
export * from "./types";
export * from "./validation";

// Database connection factory for Cloudflare Workers
export const createDatabaseConnection = async (
  databaseUrl?: string,
  options?: {
    isWorkers?: boolean;
    maxConnections?: number;
    idleTimeout?: number;
  },
) => {
  const { createDatabase, createHyperdriveDatabase } = await import(
    "./migrations"
  );

  const url =
    databaseUrl ||
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for env vars
    process.env["HYPERDRIVE_URL"] ||
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for env vars
    process.env["DATABASE_URL"] ||
    "postgresql://x402_user:x402_password@localhost:5432/x402_learning_lab";

  // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for env vars
  if (options?.isWorkers || process.env["CF_PAGES"]) {
    const hyperdriveOptions: {
      maxConnections?: number;
      idleTimeout?: number;
    } = {};

    if (options?.maxConnections !== undefined) {
      hyperdriveOptions.maxConnections = options.maxConnections;
    }
    if (options?.idleTimeout !== undefined) {
      hyperdriveOptions.idleTimeout = options.idleTimeout;
    }

    return createHyperdriveDatabase(url, hyperdriveOptions);
  }

  return createDatabase(url);
};

// Type-safe database client factory
export type DatabaseClient = Awaited<
  ReturnType<typeof createDatabaseConnection>
>;
