import { describe, expect, test } from "vitest";
import { DESCRIPTION_MAX, NAME_MAX, isUuid, parseProjectForm } from "./validation";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const valid = { name: "Website", description: "", status: "active", startDate: "", dueDate: "" };

describe("parseProjectForm", () => {
  test("accepts a name only, normalising empty optional fields to null", () => {
    expect(parseProjectForm(form(valid))).toEqual({
      success: true,
      data: { name: "Website", description: null, status: "active", startDate: null, dueDate: null },
      values: valid,
    });
  });

  test("trims name and description", () => {
    const result = parseProjectForm(form({ ...valid, name: "  Website  ", description: "  Hi  " }));
    expect(result.success && result.data).toMatchObject({ name: "Website", description: "Hi" });
  });

  test("accepts all fields", () => {
    const result = parseProjectForm(
      form({ name: "A", description: "d", status: "completed", startDate: "2026-01-01", dueDate: "2026-02-01" }),
    );
    expect(result.success && result.data).toEqual({
      name: "A",
      description: "d",
      status: "completed",
      startDate: "2026-01-01",
      dueDate: "2026-02-01",
    });
  });

  test("allows the due date to equal the start date", () => {
    expect(parseProjectForm(form({ ...valid, startDate: "2026-01-01", dueDate: "2026-01-01" })).success).toBe(true);
  });

  test.each(["", "   "])("rejects a blank name %j", (name) => {
    const result = parseProjectForm(form({ ...valid, name }));
    expect(!result.success && result.fieldErrors.name).toEqual(["Name is required"]);
  });

  test("treats missing fields like empty ones", () => {
    const result = parseProjectForm(new FormData());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.name).toBeDefined();
      expect(result.fieldErrors.status).toBeDefined();
    }
  });

  test("rejects an over-long name and description", () => {
    const result = parseProjectForm(
      form({ ...valid, name: "x".repeat(NAME_MAX + 1), description: "x".repeat(DESCRIPTION_MAX + 1) }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.name).toBeDefined();
      expect(result.fieldErrors.description).toBeDefined();
    }
  });

  test("rejects an unknown status", () => {
    const result = parseProjectForm(form({ ...valid, status: "paused" }));
    expect(!result.success && result.fieldErrors.status).toEqual(["Choose a valid status"]);
  });

  test.each(["2026-13-01", "2026-02-30", "01/02/2026", "tomorrow"])("rejects invalid date %j", (startDate) => {
    const result = parseProjectForm(form({ ...valid, startDate }));
    expect(!result.success && result.fieldErrors.startDate).toEqual(["Enter a valid date"]);
  });

  test("rejects a due date before the start date, reported on dueDate", () => {
    const result = parseProjectForm(form({ ...valid, startDate: "2026-02-01", dueDate: "2026-01-01" }));
    expect(!result.success && result.fieldErrors.dueDate).toEqual([
      "Due date must be on or after the start date",
    ]);
  });

  test("returns the submitted values so the form can be refilled", () => {
    const result = parseProjectForm(form({ ...valid, name: "", description: "keep me" }));
    expect(!result.success && result.values.description).toBe("keep me");
  });

  test("ignores unknown fields such as Server Action internals", () => {
    const result = parseProjectForm(form({ ...valid, $ACTION_ID_x: "1", id: "other" }));
    expect(result.success && Object.keys(result.data).sort()).toEqual([
      "description",
      "dueDate",
      "name",
      "startDate",
      "status",
    ]);
  });
});

describe("isUuid", () => {
  test("accepts uuids and rejects other strings", () => {
    expect(isUuid("3f2b8c1e-9d4a-4b6e-8a1f-0c9d7e5a2b34")).toBe(true);
    expect(isUuid("123")).toBe(false);
    expect(isUuid("../etc/passwd")).toBe(false);
  });
});
