import { statusLabels } from "../format";
import type { ProjectStatus } from "../schema";

// One source of truth for status colour, used by the list, the detail page and the form.
const styles: Record<ProjectStatus, { badge: string; dot: string }> = {
  active: { badge: "bg-success-soft text-success", dot: "bg-success" },
  completed: { badge: "bg-info-soft text-info", dot: "bg-info" },
  archived: { badge: "bg-neutral-soft text-neutral", dot: "bg-neutral" },
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const { badge, dot } = styles[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${badge}`}>
      <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {statusLabels[status]}
    </span>
  );
}
