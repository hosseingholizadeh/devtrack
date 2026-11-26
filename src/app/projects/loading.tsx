import { PageHeader } from "@/components/page-header";
import { ProjectListSkeleton } from "@/features/projects/components/project-list";

export default function Loading() {
  return (
    <>
      <PageHeader title="Projects" description="Loading…" />
      <ProjectListSkeleton />
    </>
  );
}
