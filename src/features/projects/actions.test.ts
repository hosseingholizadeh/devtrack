// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import type { Database } from "@/lib/db/client";
import { createTestDb } from "@/test/test-db";

const mocks = vi.hoisted(() => ({
  db: undefined as unknown,
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/db/client", () => ({ getDb: () => mocks.db }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { createProjectAction, deleteProjectAction, updateProjectAction } from "./actions";
import { createProject, getProject, listProjects } from "./repository";
import { projects } from "./schema";

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
}, 60_000); // PGlite boots a WASM PostgreSQL and runs the migrations
afterAll(() => close());
beforeEach(async () => {
  mocks.db = db;
  await db.delete(projects);
  mocks.revalidatePath.mockClear();
  mocks.redirect.mockClear();
});

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}
const valid = { name: "Website", description: "", status: "active", startDate: "", dueDate: "" };
const existing = { name: "Old", description: null, status: "active", startDate: null, dueDate: null } as const;
const missingId = "00000000-0000-4000-8000-000000000000";

/** Makes every database call throw, like an unreachable server. */
function breakDatabase() {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const fail = () => {
    throw new Error("connection refused");
  };
  mocks.db = { insert: fail, update: fail, delete: fail, select: fail };
  return spy;
}

describe("createProjectAction", () => {
  test("creates the project, revalidates the list and redirects to it", async () => {
    await expect(createProjectAction({}, form(valid))).rejects.toThrow(
      /^NEXT_REDIRECT:\/projects\/[0-9a-f-]{36}\?notice=created$/,
    );
    const [project] = await listProjects(db);
    expect(project.name).toBe("Website");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/projects");
  });

  test("returns field errors and values, and writes nothing, when invalid", async () => {
    const state = await createProjectAction({}, form({ ...valid, name: "", description: "keep" }));
    expect(state.fieldErrors?.name).toEqual(["Name is required"]);
    expect(state.values?.description).toBe("keep");
    expect(await listProjects(db)).toHaveLength(0);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  test("returns a form-level error when the database fails", async () => {
    const spy = breakDatabase();
    const state = await createProjectAction({}, form(valid));
    expect(state.message).toBe("Could not save the project. Please try again.");
    expect(state.values?.name).toBe("Website");
    expect(mocks.redirect).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("updateProjectAction", () => {
  test("updates the project and redirects to its page", async () => {
    const { id } = await createProject(db, existing);
    await expect(updateProjectAction(id, {}, form({ ...valid, name: "New", status: "completed" }))).rejects.toThrow(
      `NEXT_REDIRECT:/projects/${id}?notice=updated`,
    );
    expect(await getProject(db, id)).toMatchObject({ name: "New", status: "completed" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/projects");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/projects/${id}`);
  });

  test("returns field errors when invalid and leaves the project unchanged", async () => {
    const { id } = await createProject(db, existing);
    const state = await updateProjectAction(id, {}, form({ ...valid, startDate: "2026-02-01", dueDate: "2026-01-01" }));
    expect(state.fieldErrors?.dueDate).toBeDefined();
    expect((await getProject(db, id))!.name).toBe("Old");
  });

  test("reports a missing project or a malformed id without throwing", async () => {
    expect((await updateProjectAction(missingId, {}, form(valid))).message).toMatch(/no longer exists/);
    expect((await updateProjectAction("not-a-uuid", {}, form(valid))).message).toMatch(/no longer exists/);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  test("returns a form-level error when the database fails", async () => {
    const spy = breakDatabase();
    const state = await updateProjectAction(missingId, {}, form(valid));
    expect(state.message).toBe("Could not save the project. Please try again.");
    spy.mockRestore();
  });
});

describe("deleteProjectAction", () => {
  test("deletes the project and redirects to the list", async () => {
    const { id } = await createProject(db, existing);
    await expect(deleteProjectAction(id)).rejects.toThrow("NEXT_REDIRECT:/projects?notice=deleted");
    expect(await getProject(db, id)).toBeUndefined();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/projects");
  });

  test("is idempotent for an unknown id and tolerates a malformed one", async () => {
    await expect(deleteProjectAction(missingId)).rejects.toThrow(
      "NEXT_REDIRECT:/projects?notice=deleted",
    );
    await expect(deleteProjectAction("not-a-uuid")).rejects.toThrow(
      "NEXT_REDIRECT:/projects?notice=deleted",
    );
  });

  test("returns an error message when the database fails", async () => {
    const spy = breakDatabase();
    const state = await deleteProjectAction(missingId);
    expect(state.message).toBe("Could not delete the project. Please try again.");
    expect(mocks.redirect).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
