import { connection } from "next/server";
import { getDb } from "@/lib/db/client";
import { getProject, listProjects } from "./repository";
import { isUuid } from "./validation";

// Reads run at request time: `connection()` keeps them out of prerendering (no database at build time).
// Callers render these inside a <Suspense> boundary.

export async function fetchProjects() {
  await connection();
  return listProjects(getDb());
}

/** Returns `undefined` for unknown ids and for ids that are not valid UUIDs. */
export async function fetchProject(id: string) {
  await connection();
  if (!isUuid(id)) return undefined;
  return getProject(getDb(), id);
}
