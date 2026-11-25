import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProjectList, ProjectListSkeleton } from "@/features/projects/components/project-list";
import { ProjectNotice } from "@/features/projects/components/project-notice";
import { fetchProjects } from "@/features/projects/queries";

export const metadata: Metadata = { title: "Projects" };

async function Projects({ searchParams }: { searchParams: PageProps<"/projects">["searchParams"] }) {
  const [projects, { notice }] = await Promise.all([fetchProjects(), searchParams]);
  return (
    <>
      <ProjectNotice notice={notice} />
      <ProjectList projects={projects} />
    </>
  );
}

export default function ProjectsPage(props: PageProps<"/projects">) {
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Link
          href="/projects/new"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          New project
        </Link>
      </div>
      {/* Request-time data (database, searchParams) streams in behind the skeleton. */}
      <Suspense fallback={<ProjectListSkeleton />}>
        <Projects searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
