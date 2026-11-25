import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Project } from "../schema";
import { ProjectList, ProjectListSkeleton } from "./project-list";

const project = (overrides: Partial<Project>): Project => ({
  id: "3f2b8c1e-9d4a-4b6e-8a1f-0c9d7e5a2b34",
  name: "Website",
  description: null,
  status: "active",
  startDate: null,
  dueDate: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});

describe("ProjectList", () => {
  test("shows an empty state with a link to create a project", () => {
    render(<ProjectList projects={[]} />);
    expect(screen.getByRole("heading", { name: "No projects yet" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create a project" }).getAttribute("href")).toBe("/projects/new");
  });

  test("lists projects as links to their detail pages, with status and due date", () => {
    render(
      <ProjectList
        projects={[
          project({ name: "Website", dueDate: "2026-04-01" }),
          project({ id: "7c1d9a52-0b3e-4f6a-9d8c-1e2f3a4b5c6d", name: "API", status: "archived" }),
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    const first = within(items[0]);
    expect(first.getByRole("link").getAttribute("href")).toBe("/projects/3f2b8c1e-9d4a-4b6e-8a1f-0c9d7e5a2b34");
    expect(first.getByText("Due Apr 1, 2026")).toBeTruthy();
    expect(first.getByText("Active")).toBeTruthy();
    expect(within(items[1]).getByText("Archived")).toBeTruthy();
    expect(within(items[1]).queryByText(/^Due/)).toBeNull();
  });
});

describe("ProjectListSkeleton", () => {
  test("announces loading", () => {
    render(<ProjectListSkeleton />);
    expect(screen.getByRole("status", { name: "Loading projects" })).toBeTruthy();
  });
});
