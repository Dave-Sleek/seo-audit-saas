// app/api/projects/[id]/collaborators/[collaboratorId]/route.ts

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import {
  projectCollaborators,
  projects,
} from "@/app/db/schema";

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{ id: string; collaboratorId: string }>;
  }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  const { id, collaboratorId } = await context.params;

  /* ---------- Owner check ---------- */

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(eq(projects.id, id), eq(projects.userId, user.id))
    )
    .limit(1);

  if (!project) {
    return NextResponse.json(
      { error: "Project not found." },
      { status: 404 }
    );
  }

  /* ---------- Delete ---------- */

  const [deleted] = await db
    .delete(projectCollaborators)
    .where(
      and(
        eq(projectCollaborators.id, collaboratorId),
        eq(projectCollaborators.projectId, id)
      )
    )
    .returning();

  if (!deleted) {
    return NextResponse.json(
      { error: "Collaborator not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}