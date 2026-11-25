import { z } from "zod";
import { projectStatuses, type ProjectStatus } from "./schema";

export const NAME_MAX = 100;
export const DESCRIPTION_MAX = 2000;

const emptyToNull = (value: string) => (value === "" ? null : value);

const dateField = z
  .string()
  .trim()
  .transform(emptyToNull)
  .pipe(z.iso.date({ error: "Enter a valid date" }).nullable());

export const projectInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(NAME_MAX, `Name must be at most ${NAME_MAX} characters`),
    description: z
      .string()
      .trim()
      .max(DESCRIPTION_MAX, `Description must be at most ${DESCRIPTION_MAX} characters`)
      .transform(emptyToNull),
    status: z.enum(projectStatuses, { error: "Choose a valid status" }),
    startDate: dateField,
    dueDate: dateField,
  })
  .refine((p) => !p.startDate || !p.dueDate || p.dueDate >= p.startDate, {
    path: ["dueDate"],
    message: "Due date must be on or after the start date",
  });

export type ProjectInput = z.output<typeof projectInputSchema>;

export const projectFieldNames = ["name", "description", "status", "startDate", "dueDate"] as const;
export type ProjectFieldName = (typeof projectFieldNames)[number];

/** Raw (string) form values, used to refill the form after a failed submit. */
export type ProjectFormValues = Record<ProjectFieldName, string>;
export type ProjectFieldErrors = Partial<Record<ProjectFieldName, string[]>>;

export type ParseResult =
  | { success: true; data: ProjectInput; values: ProjectFormValues }
  | { success: false; values: ProjectFormValues; fieldErrors: ProjectFieldErrors };

/** Reads only the known fields from FormData; anything else (e.g. `$ACTION_*`) is ignored. */
export function readProjectForm(formData: FormData): ProjectFormValues {
  const read = (key: ProjectFieldName) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  return {
    name: read("name"),
    description: read("description"),
    status: read("status"),
    startDate: read("startDate"),
    dueDate: read("dueDate"),
  };
}

export function parseProjectForm(formData: FormData): ParseResult {
  const values = readProjectForm(formData);
  const result = projectInputSchema.safeParse(values);
  if (result.success) return { success: true, data: result.data, values };
  return { success: false, values, fieldErrors: z.flattenError(result.error).fieldErrors };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

export const DEFAULT_STATUS: ProjectStatus = "active";
