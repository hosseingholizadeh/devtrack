"use client";

import { useState } from "react";
import { PencilIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { ProjectFormState } from "../action-state";
import type { ProjectFormValues } from "../validation";
import { ProjectForm } from "./project-form";

type Props = {
  action: (prev: ProjectFormState, formData: FormData) => Promise<ProjectFormState>;
  initialValues: ProjectFormValues;
};

/**
 * "Edit" trigger that opens the edit form in a side panel. The page mounts it with a `key` that changes when
 * the project is saved, which resets this component and so closes the panel after a successful update.
 */
export function EditProjectButton({ action, initialValues }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("secondary")}>
        <PencilIcon />
        Edit
      </button>
      {open ? (
        <Sheet title="Edit project" description="Update the details of this project." onClose={() => setOpen(false)}>
          <ProjectForm
            action={action}
            initialValues={initialValues}
            submitLabel="Save changes"
            onCancel={() => setOpen(false)}
          />
        </Sheet>
      ) : null}
    </>
  );
}
