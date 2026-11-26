// @vitest-environment node
//
// Validates the generated migrations against a REAL PostgreSQL server (PGlite is a WASM build, so this
// guards against dialect differences). Skipped unless TEST_DATABASE_URL is set, e.g.
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/devtrack_test npm test
// CI provides a PostgreSQL service. The database is WIPED, so its name must end in "_test".
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import type { Database } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { createProject, deleteProject, getProject, listProjects, updateProject } from "./repository";

const url = process.env.TEST_DATABASE_URL;
if (url && !/_test$/.test(new URL(url).pathname.slice(1))) {
  throw new Error("TEST_DATABASE_URL must point at a database whose name ends in _test (it is wiped).");
}

describe.skipIf(!url)("migrations on real PostgreSQL", () => {
  let pool: Pool;
  let db: Database;
  const orm = () => db as unknown as ReturnType<typeof drizzle>;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    const raw = drizzle(pool, { schema });
    await raw.execute(sql`drop schema if exists public cascade`);
    await raw.execute(sql`drop schema if exists drizzle cascade`);
    await raw.execute(sql`create schema public`);
    db = raw as unknown as Database;
    await migrate(orm(), { migrationsFolder: "./drizzle" });
  });
  afterAll(() => pool?.end());

  test("creates the projects table with the expected columns", async () => {
    const { rows } = await pool.query(
      `select column_name, data_type, is_nullable from information_schema.columns
       where table_name = 'projects' order by column_name`,
    );
    expect(rows).toEqual([
      { column_name: "created_at", data_type: "timestamp with time zone", is_nullable: "NO" },
      { column_name: "description", data_type: "text", is_nullable: "YES" },
      { column_name: "due_date", data_type: "date", is_nullable: "YES" },
      { column_name: "id", data_type: "uuid", is_nullable: "NO" },
      { column_name: "name", data_type: "text", is_nullable: "NO" },
      { column_name: "start_date", data_type: "date", is_nullable: "YES" },
      { column_name: "status", data_type: "USER-DEFINED", is_nullable: "NO" },
      { column_name: "updated_at", data_type: "timestamp with time zone", is_nullable: "NO" },
    ]);
  });

  test("defines the status enum", async () => {
    const { rows } = await pool.query(`select unnest(enum_range(null::project_status))::text as v`);
    expect(rows.map((r) => r.v)).toEqual(["active", "completed", "archived"]);
  });

  test("is idempotent when migrations are re-run", async () => {
    await expect(migrate(orm(), { migrationsFolder: "./drizzle" })).resolves.not.toThrow();
  });

  test("supports the full CRUD lifecycle", async () => {
    const created = await createProject(db, {
      name: "Real PG",
      description: null,
      status: "active",
      startDate: "2026-03-09",
      dueDate: null,
    });
    expect(await getProject(db, created.id)).toMatchObject({ name: "Real PG", startDate: "2026-03-09" });
    const updated = await updateProject(db, created.id, {
      name: "Renamed",
      description: "d",
      status: "archived",
      startDate: null,
      dueDate: null,
    });
    expect(updated).toMatchObject({ name: "Renamed", status: "archived" });
    expect((await listProjects(db)).map((p) => p.id)).toContain(created.id);
    expect(await deleteProject(db, created.id)).toBe(true);
    expect(await getProject(db, created.id)).toBeUndefined();
  });

  test("enforces the check constraints", async () => {
    await expect(
      createProject(db, { name: " ", description: null, status: "active", startDate: null, dueDate: null }),
    ).rejects.toThrow();
    await expect(
      createProject(db, {
        name: "x",
        description: null,
        status: "active",
        startDate: "2026-02-01",
        dueDate: "2026-01-01",
      }),
    ).rejects.toThrow();
  });
});
