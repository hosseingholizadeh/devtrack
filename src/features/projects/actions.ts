"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import type { DeleteProjectState, ProjectFormState } from "./action-state";
import { createProject, deleteProject, updateProject } from "./repository";
import { isUuid, parseProjectForm } from "./validation";

// Authentication is out of scope for this slice. When it lands, check the session at the top of each action.

const SAVE_FAILED = "Could not save the project. Please try again.";

export async function createProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const parsed = parseProjectForm(formData);
  if (!parsed.success) return { fieldErrors: parsed.fieldErrors, values: parsed.values };

  let id: string;
  try {
    ({ id } = await createProject(getDb(), parsed.data));
  } catch (error) {
    console.error("createProjectAction failed", error);
    return { message: SAVE_FAILED, values: parsed.values };
  }

  revalidatePath("/projects");
  redirect(`/projects/${id}?notice=created`);
}

export async function updateProjectAction(
  id: string,
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  if (!isUuid(id)) return { message: "This project no longer exists." };

  const parsed = parseProjectForm(formData);
  if (!parsed.success) return { fieldErrors: parsed.fieldErrors, values: parsed.values };

  try {
    const updated = await updateProject(getDb(), id, parsed.data);
    if (!updated) return { message: "This project no longer exists.", values: parsed.values };
  } catch (error) {
    console.error("updateProjectAction failed", error);
    return { message: SAVE_FAILED, values: parsed.values };
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  redirect(`/projects/${id}?notice=updated`);
}

/** Bound to a project id (`.bind(null, id)`) and used with `useActionState`, which also passes (prevState, formData); both are ignored. */
export async function deleteProjectAction(id: string): Promise<DeleteProjectState> {
  if (isUuid(id)) {
    try {
      // Idempotent: a project that is already gone counts as deleted.
      await deleteProject(getDb(), id);
    } catch (error) {
      console.error("deleteProjectAction failed", error);
      return { message: "Could not delete the project. Please try again." };
    }
  }

  revalidatePath("/projects");
  redirect("/projects?notice=deleted");
}
