import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Database } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

/** A fresh in-memory PostgreSQL (PGlite) with the real migration files applied. One per test file. */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return { db: db as Database, close: () => client.close() };
}
