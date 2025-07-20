import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://x402_user:x402_password@localhost:5432/x402_learning_lab",
  },
  verbose: true,
  strict: true,
  migrations: {
    prefix: "timestamp",
  },
});