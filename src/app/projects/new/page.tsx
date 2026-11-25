import type { Metadata } from "next";
import { createProjectAction } from "@/features/projects/actions";
import { ProjectForm } from "@/features/projects/components/project-form";

export const metadata: Metadata = { title: "New project" };

export default function NewProjectPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">New project</h1>
      <ProjectForm action={createProjectAction} submitLabel="Create project" cancelHref="/projects" />
    </>
  );
}
