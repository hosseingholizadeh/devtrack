import type { ProjectFieldErrors, ProjectFormValues } from "./validation";

export type ProjectFormState = {
  /** Form-level error (e.g. the database was unreachable). */
  message?: string;
  fieldErrors?: ProjectFieldErrors;
  /** The submitted values, so the form can be refilled after a validation error. */
  values?: ProjectFormValues;
};

export type DeleteProjectState = { message?: string };

export const initialFormState: ProjectFormState = {};
export const initialDeleteState: DeleteProjectState = {};
