import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { deleteProjectAction } from "@/features/projects/actions";
import { DeleteProjectButton } from "@/features/projects/components/delete-project-button";
import { ProjectNotice } from "@/features/projects/components/project-notice";
import { ProjectStatusBadge } from "@/features/projects/components/project-status-badge";
import { formatDate, formatTimestamp } from "@/features/projects/format";
import { fetchProject } from "@/features/projects/queries";

export const metadata: Metadata = { title: "Project" };

async function ProjectDetails({ params, searchParams }: Pick<PageProps<"/projects/[id]">, "params" | "searchParams">) {
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  const project = await fetchProject(id);
  if (!project) notFound();

  return (
    <>
      <ProjectNotice notice={notice} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <div className="mt-2">
            <ProjectStatusBadge status={project.status} />
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Link
            href={`/projects/${project.id}/edit`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
          >
            Edit
          </Link>
          <DeleteProjectButton
            projectName={project.name}
            action={deleteProjectAction.bind(null, project.id)}
          />
        </div>
      </div>

      <p className="mb-6 whitespace-pre-wrap text-sm">
        {project.description ?? (
          <span className="text-zinc-600 dark:text-zinc-400">No description.</span>
        )}
      </p>

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium">Start date</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{formatDate(project.startDate)}</dd>
        </div>
        <div>
          <dt className="font-medium">Due date</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{formatDate(project.dueDate)}</dd>
        </div>
        <div>
          <dt className="font-medium">Created</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{formatTimestamp(project.createdAt)}</dd>
        </div>
        <div>
          <dt className="font-medium">Last updated</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{formatTimestamp(project.updatedAt)}</dd>
        </div>
      </dl>
    </>
  );
}

export default function ProjectPage(props: PageProps<"/projects/[id]">) {
  return (
    <>
      <Link href="/projects" className="mb-4 inline-block text-sm text-zinc-600 underline dark:text-zinc-400">
        ← All projects
      </Link>
      <Suspense fallback={<div role="status" aria-label="Loading project" className="h-40 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />}>
        <ProjectDetails params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
