"use client";

import { useEffect } from "react";

export default function ProjectsError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="rounded-lg border border-red-300 p-6 dark:border-red-800">
      <h2 className="text-lg font-medium">Something went wrong</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        We couldn&apos;t load your projects. Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-4 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
      >
        Try again
      </button>
    </div>
  );
}
