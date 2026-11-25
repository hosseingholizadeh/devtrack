import Link from "next/link";

export default function ProjectNotFound() {
  return (
    <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
      <h2 className="text-lg font-medium">Project not found</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        It may have been deleted, or the link is wrong.
      </p>
      <Link href="/projects" className="mt-4 inline-block text-sm font-medium underline">
        Back to projects
      </Link>
    </div>
  );
}
