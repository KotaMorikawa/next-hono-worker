import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export async function runMigrations(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sql);

  await migrate(db, { migrationsFolder: "./migrations" });

  await sql.end();
}

export async function createDatabase(databaseUrl: string) {
  const sql = postgres(databaseUrl);
  const db = drizzle(sql);

  return { db, sql };
}
