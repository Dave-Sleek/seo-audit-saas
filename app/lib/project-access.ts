// app/lib/project-access.ts

import { and, eq } from "drizzle-orm";

import { db } from "@/app/db";
import {
  projectCollaborators,
  projects,
} from "@/app/db/schema";

export type ProjectAccess =
  | { role: "owner"; projectId: string }
  | { role: "collaborator"; projectId: string }
  | null;

/**
 * Resolve a user's access to a project.
 *
 * Returns the role if the user is either the owner or an
 * accepted collaborator, otherwise null.
 */
export async function getProjectAccess(
  userId: string,
  projectId: string
): Promise<ProjectAccess> {
  /* ---------- Owner check ---------- */

  const [owned] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(eq(projects.id, projectId), eq(projects.userId, userId))
    )
    .limit(1);

  if (owned) {
    return { role: "owner", projectId };
  }

  /* ---------- Collaborator check ---------- */

  const [collab] = await db
    .select({ id: projectCollaborators.id })
    .from(projectCollaborators)
    .where(
      and(
        eq(projectCollaborators.projectId, projectId),
        eq(projectCollaborators.userId, userId),
        eq(projectCollaborators.status, "accepted")
      )
    )
    .limit(1);

  if (collab) {
    return { role: "collaborator", projectId };
  }

  return null;
}

/**
 * Throws-free convenience: does the user have at least
 * view access?
 */
export async function canViewProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  return (await getProjectAccess(userId, projectId)) !== null;
}

/**
 * Does the user own the project?
 */
export async function isProjectOwner(
  userId: string,
  projectId: string
): Promise<boolean> {
  const access = await getProjectAccess(userId, projectId);
  return access?.role === "owner";
}