import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Small element above the title, e.g. a breadcrumb. */
  eyebrow?: ReactNode;
};

export function PageHeader({ title, description, actions, eyebrow }: Props) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <div className="mt-1 text-sm text-muted">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
