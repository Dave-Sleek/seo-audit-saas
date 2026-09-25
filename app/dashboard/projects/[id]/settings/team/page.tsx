// app/dashboard/projects/[id]/settings/team/page.tsx

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";

import { getCurrentUser } from "@/app/lib/auth";
import { isPaidSubscriber } from "@/app/lib/subscription";
import { db } from "@/app/db";
import {
  projectCollaborators,
  projects,
  users,
} from "@/app/db/schema";
import TeamSettingsClient from "./team-settings-client";

export const dynamic = "force-dynamic";

export default async function TeamSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  /* ---------- Owner check ---------- */

  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.id, id), eq(projects.userId, user.id))
    )
    .limit(1);

  if (!project) {
    notFound();
  }

  const isPaid = await isPaidSubscriber(user.id);

  /* ---------- Load collaborators ---------- */

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
    .leftJoin(users, eq(projectCollaborators.userId, users.id))
    .where(eq(projectCollaborators.projectId, id))
    .orderBy(desc(projectCollaborators.createdAt));

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <nav className="breadcrumbs mb-3" aria-label="Breadcrumb">
          <Link href="/dashboard">Dashboard</Link>
          <span className="breadcrumb-separator">/</span>
          <Link href={`/dashboard/projects/${project.id}`}>
            {project.name}
          </Link>
          <span className="breadcrumb-separator">/</span>
          <span>Team</span>
        </nav>

        <div className="eyebrow mb-1">Project settings</div>
        <h1 className="page-title">Team access</h1>
        <p className="page-subtitle">
          Invite people to view this project&apos;s audits and
          reports. Collaborators get view-only access.
        </p>
      </div>

      <TeamSettingsClient
        projectId={project.id}
        initialCollaborators={rows}
        canInvite={isPaid}
      />
    </div>
  );
}