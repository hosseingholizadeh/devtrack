import Link from "next/link";
import { FolderIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";

export default function ProjectNotFound() {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-line bg-surface px-6 py-16 text-center shadow-sm">
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-subtle text-muted">
        <FolderIcon width={22} height={22} />
      </div>
      <h2 className="text-lg font-semibold">Project not found</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">It may have been deleted, or the link is wrong.</p>
      <Link href="/projects" className={`${buttonClass("primary", "lg")} mt-6`}>
        Back to projects
      </Link>
    </div>
  );
}
