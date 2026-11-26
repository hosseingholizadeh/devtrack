// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import type { Database } from "@/lib/db/client";
import { createTestDb } from "@/test/test-db";
import { createProject, deleteProject, getProject, listProjects, updateProject } from "./repository";
import { projects } from "./schema";
import type { ProjectInput } from "./validation";

const input = (overrides: Partial<ProjectInput> = {}): ProjectInput => ({
  name: "Website",
  description: null,
  status: "active",
  startDate: null,
  dueDate: null,
  ...overrides,
});

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
}, 60_000); // PGlite boots a WASM PostgreSQL and runs the migrations
afterAll(() => close());
beforeEach(async () => {
  await db.delete(projects);
});

const missingId = "00000000-0000-4000-8000-000000000000";
const wait = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("project repository (PGlite)", () => {
  test("creates a project with defaults and timestamps", async () => {
    const project = await createProject(db, input());
    expect(project).toMatchObject({ name: "Website", description: null, status: "active", startDate: null, dueDate: null });
    expect(project.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(project.createdAt).toBeInstanceOf(Date);
    expect(project.updatedAt).toBeInstanceOf(Date);
  });

  test("round-trips dates as calendar-date strings", async () => {
    const { id } = await createProject(db, input({ startDate: "2026-03-09", dueDate: "2026-04-01" }));
    expect(await getProject(db, id)).toMatchObject({ startDate: "2026-03-09", dueDate: "2026-04-01" });
  });

  test("getProject returns undefined for an unknown id", async () => {
    expect(await getProject(db, missingId)).toBeUndefined();
  });

  test("lists newest first, and returns [] when empty", async () => {
    expect(await listProjects(db)).toEqual([]);
    const first = await createProject(db, input({ name: "First" }));
    await wait();
    const second = await createProject(db, input({ name: "Second" }));
    expect((await listProjects(db)).map((p) => p.id)).toEqual([second.id, first.id]);
  });

  test("updates fields and bumps updated_at but not created_at", async () => {
    const created = await createProject(db, input());
    await wait();
    const updated = await updateProject(db, created.id, input({ name: "Renamed", status: "archived", description: "d" }));
    expect(updated).toMatchObject({ name: "Renamed", status: "archived", description: "d" });
    expect(updated!.createdAt).toEqual(created.createdAt);
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
  });

  test("update can clear optional fields", async () => {
    const { id } = await createProject(db, input({ description: "d", startDate: "2026-01-01" }));
    expect(await updateProject(db, id, input())).toMatchObject({ description: null, startDate: null });
  });

  test("update returns undefined for an unknown id", async () => {
    expect(await updateProject(db, missingId, input())).toBeUndefined();
  });

  test("deletes a project, and reports false when it does not exist", async () => {
    const { id } = await createProject(db, input());
    expect(await deleteProject(db, id)).toBe(true);
    expect(await getProject(db, id)).toBeUndefined();
    expect(await deleteProject(db, id)).toBe(false);
  });

  test("the database itself rejects a blank name and an inverted date range", async () => {
    await expect(createProject(db, input({ name: "   " }))).rejects.toThrow();
    await expect(createProject(db, input({ startDate: "2026-02-01", dueDate: "2026-01-01" }))).rejects.toThrow();
    expect(await listProjects(db)).toHaveLength(0);
  });
});
