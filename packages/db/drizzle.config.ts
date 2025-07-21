import { defineConfig } from "drizzle-kit";

// Environment-aware database URL resolution
const getDatabaseUrl = (): string => {
  // Production: Hyperdrive connection
  if (process.env.HYPERDRIVE_URL) {
    return process.env.HYPERDRIVE_URL;
  }
  
  // Production fallback: Direct database URL
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  // Development: Local PostgreSQL
  return "postgresql://x402_user:x402_password@localhost:5432/x402_learning_lab";
};

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: getDatabaseUrl(),
  },
  verbose: true,
  strict: true,
  migrations: {
    prefix: "timestamp",
    table: "__drizzle_migrations__",
    schema: "public",
  },
  // Cloudflare Workers optimizations
  introspect: {
    casing: "preserve",
  },
});