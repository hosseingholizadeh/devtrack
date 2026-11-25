import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "./schema";

/** Driver-agnostic database type: node-postgres in the app, PGlite in unit tests. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

// Keep one pool per server process. In `next dev`, modules reload on edits, so the pool lives on globalThis.
const globalForDb = globalThis as unknown as { devtrackDb?: Database };

/**
 * Lazily creates the PostgreSQL client (any PostgreSQL: local, Neon, ...) so importing this module never needs
 * `DATABASE_URL`, e.g. at build time.
 */
export function getDb(): Database {
  if (!globalForDb.devtrackDb) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set. See README.md (Database) for setup.");
    }
    globalForDb.devtrackDb = drizzle(new Pool({ connectionString: url }), { schema });
  }
  return globalForDb.devtrackDb;
}
