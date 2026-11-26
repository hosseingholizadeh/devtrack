import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { updateProjectAction } from "@/features/projects/actions";
import { ProjectForm } from "@/features/projects/components/project-form";
import { fetchProject } from "@/features/projects/queries";

export const metadata: Metadata = { title: "Edit project" };

async function EditProject({ params }: Pick<PageProps<"/projects/[id]/edit">, "params">) {
  const { id } = await params;
  const project = await fetchProject(id);
  if (!project) notFound();

  return (
    <div className="max-w-2xl overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
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
    </div>
  );
}

// Direct-URL version of the "Edit" panel on the project page.
export default function EditProjectPage(props: PageProps<"/projects/[id]/edit">) {
  return (
    <>
      <PageHeader title="Edit project" description="Update the details of this project." />
      <Suspense
        fallback={
          <div role="status" aria-label="Loading project" className="h-80 max-w-2xl animate-pulse rounded-2xl bg-subtle" />
        }
      >
        <EditProject params={props.params} />
      </Suspense>
    </>
  );
}
