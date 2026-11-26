import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronRightIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { deleteProjectAction, updateProjectAction } from "@/features/projects/actions";
import { DeleteProjectButton } from "@/features/projects/components/delete-project-button";
import { EditProjectButton } from "@/features/projects/components/edit-project-button";
import { ProjectNotice } from "@/features/projects/components/project-notice";
import { ProjectStatusBadge } from "@/features/projects/components/project-status-badge";
import { formatDate, formatTimestamp } from "@/features/projects/format";
import { fetchProject } from "@/features/projects/queries";

export const metadata: Metadata = { title: "Project" };

function Breadcrumb({ current }: { current?: string }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted">
      <Link href="/projects" className="rounded transition-colors hover:text-ink">
        Projects
      </Link>
      <ChevronRightIcon width={14} height={14} />
      <span className="max-w-[16rem] truncate text-ink" aria-current="page">
        {current ?? "…"}
      </span>
    </nav>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

async function ProjectDetails({ params, searchParams }: Pick<PageProps<"/projects/[id]">, "params" | "searchParams">) {
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  const project = await fetchProject(id);
  if (!project) notFound();

  // Changes after every successful save, so the toast and the edit panel reset (see EditProjectButton).
  const version = project.updatedAt.toISOString();

  return (
    <>
      <ProjectNotice key={version} notice={notice} />
      <PageHeader
        eyebrow={<Breadcrumb current={project.name} />}
        title={project.name}
        description={<ProjectStatusBadge status={project.status} />}
        actions={
          <>
            <EditProjectButton
              key={version}
              action={updateProjectAction.bind(null, project.id)}
              initialValues={{
                name: project.name,
                description: project.description ?? "",
                status: project.status,
                startDate: project.startDate ?? "",
                dueDate: project.dueDate ?? "",
              }}
            />
            <DeleteProjectButton projectName={project.name} action={deleteProjectAction.bind(null, project.id)} />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-line bg-surface p-6 shadow-sm lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Description</h2>
          {project.description ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{project.description}</p>
          ) : (
            <p className="text-sm text-muted">No description yet. Use Edit to add one.</p>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-surface px-6 py-3 shadow-sm">
          <h2 className="sr-only">Details</h2>
          <dl className="divide-y divide-line">
            <Detail label="Status">
              <ProjectStatusBadge status={project.status} />
            </Detail>
            <Detail label="Start date">{formatDate(project.startDate)}</Detail>
            <Detail label="Due date">{formatDate(project.dueDate)}</Detail>
            <Detail label="Created">{formatTimestamp(project.createdAt)}</Detail>
            <Detail label="Last updated">{formatTimestamp(project.updatedAt)}</Detail>
          </dl>
        </section>
      </div>
    </>
  );
}

export default function ProjectPage(props: PageProps<"/projects/[id]">) {
  return (
    <Suspense
      fallback={
        <div role="status" aria-label="Loading project" className="animate-pulse">
          <PageHeader eyebrow={<Breadcrumb />} title="Loading…" />
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="h-40 rounded-2xl bg-subtle lg:col-span-2" />
            <div className="h-40 rounded-2xl bg-subtle" />
          </div>
        </div>
      }
    >
      <ProjectDetails params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
