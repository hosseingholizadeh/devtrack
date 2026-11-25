import { statusLabels } from "../format";
import type { ProjectStatus } from "../schema";

const styles: Record<ProjectStatus, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  archived: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}
