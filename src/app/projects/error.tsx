"use client";

import { useEffect } from "react";
import { AlertIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";

export default function ProjectsError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-line bg-surface px-6 py-16 text-center shadow-sm">
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-danger-soft text-danger">
        <AlertIcon width={22} height={22} />
      </div>
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">
        We couldn&apos;t load your projects. Check your connection and try again.
      </p>
      <button type="button" onClick={() => retry()} className={`${buttonClass("primary", "lg")} mt-6`}>
        Try again
      </button>
    </div>
  );
}
