// app/dashboard/invitations/[token]/page.tsx

import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { db } from "@/app/db";
import {
  projectCollaborators,
  projects,
} from "@/app/db/schema";
import { getCurrentUser } from "@/app/lib/auth";

export const dynamic = "force-dynamic";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getCurrentUser();

  /* ---------- Look up the invitation ---------- */

  const [invite] = await db
    .select({
      collaborator: projectCollaborators,
      project: {
        id: projects.id,
        name: projects.name,
        domain: projects.domain,
        userId: projects.userId,
      },
    })
    .from(projectCollaborators)
    .innerJoin(
      projects,
      eq(projectCollaborators.projectId, projects.id)
    )
    .where(eq(projectCollaborators.token, token))
    .limit(1);

  if (!invite) {
    return <InvalidInvite reason="This invitation link is not valid." />;
  }

  if (invite.collaborator.status === "revoked") {
    return <InvalidInvite reason="This invitation was revoked." />;
  }

  /* ---------- Not logged in → send to signup/login ---------- */

  if (!user) {
    const next = `/dashboard/invitations/${token}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  /* ---------- Already accepted by this user → go to project ---------- */

  if (
    invite.collaborator.status === "accepted" &&
    invite.collaborator.userId === user.id
  ) {
    redirect(`/dashboard/projects/${invite.project.id}`);
  }

  /* ---------- Email mismatch ---------- */

  if (user.email.toLowerCase() !== invite.collaborator.invitedEmail) {
    return (
      <InvalidInvite
        reason={`This invitation was sent to ${invite.collaborator.invitedEmail}. You're signed in as ${user.email}.`}
      />
    );
  }

  /* ---------- Accept ---------- */

  const now = new Date();

  await db
    .update(projectCollaborators)
    .set({
      status: "accepted",
      userId: user.id,
      acceptedAt: now,
    })
    .where(
      and(
        eq(projectCollaborators.id, invite.collaborator.id),
        eq(projectCollaborators.status, "pending")
      )
    );

  redirect(`/dashboard/projects/${invite.project.id}`);
}

/* =========================================================
   INVALID INVITE COMPONENT
========================================================= */

function InvalidInvite({ reason }: { reason: string }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="stripe-panel p-8 text-center">
        <div
          className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ background: "var(--surface-hover, #f1f5f9)" }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--text-muted)" }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 className="section-title mb-2">Invitation unavailable</h1>

        <p
          className="mx-auto mb-6 max-w-sm text-sm leading-6"
          style={{ color: "var(--text-muted)" }}
        >
          {reason}
        </p>

        <Link
          href="/dashboard"
          className="btn-stripe btn-stripe-primary"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}