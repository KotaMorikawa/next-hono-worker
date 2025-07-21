import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Type-safe Cloudflare Workers environment detection
function isCloudflareWorkers(): boolean {
  if (typeof globalThis === "undefined") {
    return false;
  }

  if (!("navigator" in globalThis)) {
    return false;
  }

  const navigator = (globalThis as { navigator?: unknown }).navigator;

  if (typeof navigator !== "object" || navigator === null) {
    return false;
  }

  const nav = navigator as { userAgent?: unknown };

  if (typeof nav.userAgent !== "string") {
    return false;
  }

  return nav.userAgent.includes("Cloudflare-Workers");
}

const isWorkers = isCloudflareWorkers();

// Connection configuration for different environments
export const getConnectionConfig = () => {
  if (isWorkers) {
    // Optimized for Cloudflare Workers with Hyperdrive
    return {
      max: 1, // Single connection for Workers
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: { rejectUnauthorized: false },
      transform: {
        undefined: null,
      },
    };
  } else {
    // Development/local configuration
    return {
      max: 10,
      idle_timeout: 30,
      connect_timeout: 30,
    };
  }
};

export async function runMigrations(databaseUrl: string): Promise<void> {
  const config = getConnectionConfig();
  const sql = postgres(databaseUrl, { ...config, max: 1 });
  const db = drizzle(sql);

  await migrate(db, { migrationsFolder: "./migrations" });

  await sql.end();
}

export async function createDatabase(databaseUrl: string) {
  const config = getConnectionConfig();
  const sql = postgres(databaseUrl, config);
  const db = drizzle(sql);

  return { db, sql };
}

// Hyperdrive-optimized connection factory
export async function createHyperdriveDatabase(
  databaseUrl: string,
  options?: {
    maxConnections?: number;
    idleTimeout?: number;
  },
) {
  const config = {
    max: options?.maxConnections ?? 1,
    idle_timeout: options?.idleTimeout ?? 20,
    connect_timeout: 10,
    ssl: { rejectUnauthorized: false },
    transform: {
      undefined: null,
    },
  };

  const sql = postgres(databaseUrl, config);
  const db = drizzle(sql);

  return { db, sql };
}
