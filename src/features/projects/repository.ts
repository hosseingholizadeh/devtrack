import { desc, eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { projects, type Project } from "./schema";
import type { ProjectInput } from "./validation";

export async function listProjects(db: Database): Promise<Project[]> {
  return db.select().from(projects).orderBy(desc(projects.createdAt), desc(projects.id));
}

export async function getProject(db: Database, id: string): Promise<Project | undefined> {
  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  return project;
}

export async function createProject(db: Database, input: ProjectInput): Promise<Project> {
  const [project] = await db.insert(projects).values(input).returning();
  return project;
}

/** Returns `undefined` when no project has this id. Always bumps `updated_at`. */
export async function updateProject(
  db: Database,
  id: string,
  input: ProjectInput,
): Promise<Project | undefined> {
  const [project] = await db
    .update(projects)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();
  return project;
}

/** Returns whether a row was deleted. */
export async function deleteProject(db: Database, id: string): Promise<boolean> {
  const deleted = await db.delete(projects).where(eq(projects.id, id)).returning({ id: projects.id });
  return deleted.length > 0;
}
