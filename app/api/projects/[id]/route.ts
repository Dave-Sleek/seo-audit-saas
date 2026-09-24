// app/api/projects/[id]/route.ts

import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import { audits, projects } from "@/app/db/schema";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  /* ---------- Verify ownership before deleting ---------- */

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.id, id),
        eq(projects.userId, user.id)
      )
    )
    .limit(1);

  if (!project) {
    return NextResponse.json(
      { error: "Project not found." },
      { status: 404 }
    );
  }

  /* ---------- Delete ----------
   *
   * Cascades to audits, audit_pages, audit_issues, and
   * audit_links via the FK onDelete rules. Postgres handles
   * the entire subtree in one statement.
   */
  await db
    .delete(projects)
    .where(eq(projects.id, id));

  return NextResponse.json({ success: true });
}