"use client";

import { useEffect, useState } from "react";
import { CheckCircleIcon, CloseIcon } from "@/components/icons";

const messages = {
  created: "Project created.",
  updated: "Changes saved.",
  deleted: "Project deleted.",
} as const;

/**
 * Success toast driven by the `?notice=` query param set by the Server Actions' redirects.
 * It dismisses itself after a few seconds and removes the param so a refresh doesn't replay it.
 * Mount it with a `key` that changes per mutation so repeat notices show again.
 */
export function ProjectNotice({ notice }: { notice: string | string[] | undefined }) {
  const message = typeof notice === "string" && Object.hasOwn(messages, notice) ? messages[notice as keyof typeof messages] : null;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!message) return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("notice")) {
      url.searchParams.delete("notice");
      window.history.replaceState(window.history.state, "", url);
    }
    const timer = setTimeout(() => setDismissed(true), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message || dismissed) return null;
  return (
    <div className="animate-toast fixed inset-x-4 top-4 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:top-6 sm:justify-end">
      <div
        role="status"
        className="flex items-center gap-2.5 rounded-xl border border-line bg-surface py-2.5 pl-3.5 pr-2 text-sm shadow-lg"
      >
        <CheckCircleIcon width={18} height={18} className="text-success" />
        <span>{message}</span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="flex size-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-subtle hover:text-ink"
        >
          <CloseIcon width={14} height={14} />
        </button>
      </div>
    </div>
  );
}
