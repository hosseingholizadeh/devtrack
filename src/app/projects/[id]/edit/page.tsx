import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { updateProjectAction } from "@/features/projects/actions";
import { ProjectForm } from "@/features/projects/components/project-form";
import { fetchProject } from "@/features/projects/queries";

export const metadata: Metadata = { title: "Edit project" };

async function EditProject({ params }: Pick<PageProps<"/projects/[id]/edit">, "params">) {
  const { id } = await params;
  const project = await fetchProject(id);
  if (!project) notFound();

  return (
    <ProjectForm
      action={updateProjectAction.bind(null, project.id)}
      initialValues={{
        name: project.name,
        description: project.description ?? "",
        status: project.status,
        startDate: project.startDate ?? "",
        dueDate: project.dueDate ?? "",
      }}
      submitLabel="Save changes"
      cancelHref={`/projects/${project.id}`}
    />
  );
}

export default function EditProjectPage(props: PageProps<"/projects/[id]/edit">) {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Edit project</h1>
      <Suspense fallback={<div role="status" aria-label="Loading project" className="h-64 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />}>
        <EditProject params={props.params} />
      </Suspense>
    </>
  );
}
