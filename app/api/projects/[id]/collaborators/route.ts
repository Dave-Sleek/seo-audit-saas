// app/api/projects/[id]/collaborators/route.ts

import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "crypto";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import {
  projectCollaborators,
  projects,
  users,
} from "@/app/db/schema";
import { isPaidSubscriber } from "@/app/lib/subscription";
import { sendProjectInviteEmail } from "@/app/lib/email/send";

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
});

/* =========================================================
   GET — list collaborators
========================================================= */

export async function GET(
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

  /* ---------- Owner-only ---------- */

  const [project] = await db
    .select()
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

  const rows = await db
    .select({
      id: projectCollaborators.id,
      invitedEmail: projectCollaborators.invitedEmail,
      status: projectCollaborators.status,
      createdAt: projectCollaborators.createdAt,
      acceptedAt: projectCollaborators.acceptedAt,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(projectCollaborators)
    .leftJoin(
      users,
      eq(projectCollaborators.userId, users.id)
    )
    .where(eq(projectCollaborators.projectId, id))
    .orderBy(desc(projectCollaborators.createdAt));

  return NextResponse.json({ success: true, collaborators: rows });
}

/* =========================================================
   POST — invite a collaborator
========================================================= */

export async function POST(
  request: Request,
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

  /* ---------- Owner check ---------- */

  const [project] = await db
    .select()
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

  /* ---------- Paid feature ---------- */

  const paid = await isPaidSubscriber(user.id);

  if (!paid) {
    return NextResponse.json(
      {
        error:
          "Sharing projects is available on paid plans. Upgrade to invite collaborators.",
      },
      { status: 403 }
    );
  }

  /* ---------- Validate ---------- */

  const raw = await request.json().catch(() => null);
  const parsed = inviteSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const invitedEmail = parsed.data.email;

  /* ---------- Can't invite yourself ---------- */

  if (invitedEmail === user.email.toLowerCase()) {
    return NextResponse.json(
      { error: "You can't invite yourself." },
      { status: 400 }
    );
  }

  /* ---------- Already invited? ---------- */

  const [existing] = await db
    .select()
    .from(projectCollaborators)
    .where(
      and(
        eq(projectCollaborators.projectId, id),
        eq(projectCollaborators.invitedEmail, invitedEmail)
      )
    )
    .limit(1);

  if (existing && existing.status !== "revoked") {
    return NextResponse.json(
      { error: "This email has already been invited." },
      { status: 409 }
    );
  }

  /* ---------- Resolve existing account (if any) ---------- */

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, invitedEmail))
    .limit(1);

  /* ---------- Create (or refresh) the invite ---------- */

  const token = randomBytes(24).toString("hex");
  const now = new Date();

  let collaboratorId: string;

  if (existing && existing.status === "revoked") {
    const [updated] = await db
      .update(projectCollaborators)
      .set({
        token,
        status: "pending",
        userId: existingUser?.id ?? null,
        invitedBy: user.id,
        createdAt: now,
        acceptedAt: null,
      })
      .where(eq(projectCollaborators.id, existing.id))
      .returning();

    collaboratorId = updated.id;
  } else {
    const [inserted] = await db
      .insert(projectCollaborators)
      .values({
        projectId: id,
        userId: existingUser?.id ?? null,
        invitedEmail,
        invitedBy: user.id,
        token,
        status: "pending",
      })
      .returning();

    collaboratorId = inserted.id;
  }

  /* ---------- Send email (fire-and-forget) ---------- */

  void sendProjectInviteEmail({
    to: invitedEmail,
    inviterName: user.name,
    projectName: project.name,
    projectDomain: project.domain,
    token,
  });

  return NextResponse.json({
    success: true,
    collaboratorId,
  });
}