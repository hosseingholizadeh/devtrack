import Link from "next/link";
import { FolderIcon, CalendarIcon, ChevronRightIcon } from "@/components/icons";
import { formatDate } from "../format";
import type { Project } from "../schema";
import { NewProjectButton } from "./new-project-button";
import { ProjectStatusBadge } from "./project-status-badge";

const columns = "md:grid-cols-[minmax(0,1fr)_9rem_10rem_1rem]";

export function ProjectList({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <FolderIcon width={22} height={22} />
        </div>
        <h2 className="text-lg font-semibold">No projects yet</h2>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Projects keep your work organised. Create your first one to set a status and a schedule for it.
        </p>
        <div className="mt-6">
          <NewProjectButton label="Create a project" size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div
        className={`hidden grid-cols-1 gap-4 border-b border-line bg-subtle/60 px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-muted md:grid ${columns}`}
      >
        <span>Name</span>
        <span>Status</span>
        <span>Due date</span>
        <span />
      </div>
      <ul className="divide-y divide-line">
        {projects.map((project) => (
          <li key={project.id}>
            <Link
              href={`/projects/${project.id}`}
              className={`group grid grid-cols-1 items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-subtle/70 focus-visible:-outline-offset-2 md:py-3.5 ${columns}`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium group-hover:text-accent">{project.name}</span>
                {project.description ? (
                  <span className="mt-0.5 block truncate text-sm text-muted">{project.description}</span>
                ) : null}
              </span>
              <span>
                <ProjectStatusBadge status={project.status} />
              </span>
              <span className="flex items-center gap-1.5 text-sm text-muted">
                <CalendarIcon width={14} height={14} className="md:hidden" />
                <span className="md:hidden">Due</span>
                {project.dueDate ? formatDate(project.dueDate) : <span aria-label="No due date">—</span>}
              </span>
              <ChevronRightIcon
                width={16}
                height={16}
                className="hidden text-muted opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 md:block"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProjectListSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading projects"
      className="animate-pulse divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface"
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="space-y-2">
            <div className="h-3.5 w-40 rounded bg-subtle" />
            <div className="h-3 w-64 max-w-full rounded bg-subtle" />
          </div>
          <div className="h-6 w-20 rounded-full bg-subtle" />
        </div>
      ))}
    </div>
  );
}
