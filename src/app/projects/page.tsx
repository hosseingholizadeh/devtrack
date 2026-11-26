import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { NewProjectButton } from "@/features/projects/components/new-project-button";
import { ProjectList, ProjectListSkeleton } from "@/features/projects/components/project-list";
import { ProjectNotice } from "@/features/projects/components/project-notice";
import { fetchProjects } from "@/features/projects/queries";

export const metadata: Metadata = { title: "Projects" };

async function Projects({ searchParams }: { searchParams: PageProps<"/projects">["searchParams"] }) {
  const [projects, { notice }] = await Promise.all([fetchProjects(), searchParams]);
  const count = projects.length;
  return (
    <>
      <ProjectNotice notice={notice} />
      <PageHeader
        title="Projects"
        description={count === 1 ? "1 project" : `${count} projects`}
        actions={<NewProjectButton />}
      />
      <ProjectList projects={projects} />
    </>
  );
}

export default function ProjectsPage(props: PageProps<"/projects">) {
  return (
    // Request-time data (database, searchParams) streams in behind this static header + skeleton.
    <Suspense
      fallback={
        <>
          <PageHeader title="Projects" description="Loading…" actions={<NewProjectButton />} />
          <ProjectListSkeleton />
        </>
      }
    >
      <Projects searchParams={props.searchParams} />
    </Suspense>
  );
}
