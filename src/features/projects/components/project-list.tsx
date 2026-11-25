import Link from "next/link";
import { formatDate } from "../format";
import type { Project } from "../schema";
import { ProjectStatusBadge } from "./project-status-badge";

export function ProjectList({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
        <h2 className="text-lg font-medium">No projects yet</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Create your first project to start tracking your work.
        </p>
        <Link
          href="/projects/new"
          className="mt-4 inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Create a project
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {projects.map((project) => (
        <li key={project.id}>
          <Link
            href={`/projects/${project.id}`}
            className="flex flex-col gap-1 p-4 hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-zinc-900"
          >
            <span className="font-medium">{project.name}</span>
            <span className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
              {project.dueDate ? <span>Due {formatDate(project.dueDate)}</span> : null}
              <ProjectStatusBadge status={project.status} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ProjectListSkeleton() {
  return (
    <div role="status" aria-label="Loading projects" className="animate-pulse space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      ))}
    </div>
  );
}
