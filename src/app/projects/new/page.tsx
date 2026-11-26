import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { createProjectAction } from "@/features/projects/actions";
import { ProjectForm } from "@/features/projects/components/project-form";

export const metadata: Metadata = { title: "New project" };

// Direct-URL version of the "New project" panel on /projects.
export default function NewProjectPage() {
  return (
    <>
      <PageHeader title="New project" description="Give it a name; everything else is optional." />
      <div className="max-w-2xl overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <ProjectForm action={createProjectAction} submitLabel="Create project" cancelHref="/projects" />
      </div>
    </>
  );
}
