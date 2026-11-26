"use client";

import { useState } from "react";
import { PlusIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { createProjectAction } from "../actions";
import { ProjectForm } from "./project-form";

/** "New project" trigger that opens the create form in a side panel. */
export function NewProjectButton({ label = "New project", size = "md" }: { label?: string; size?: "md" | "lg" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("primary", size)}>
        <PlusIcon />
        {label}
      </button>
      {open ? (
        <Sheet
          title="New project"
          description="Give it a name; everything else is optional."
          onClose={() => setOpen(false)}
        >
          <ProjectForm action={createProjectAction} submitLabel="Create project" onCancel={() => setOpen(false)} />
        </Sheet>
      ) : null}
    </>
  );
}
