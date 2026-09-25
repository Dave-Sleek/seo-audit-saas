// app/dashboard/team/page.tsx

import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";

import { getCurrentUser } from "@/app/lib/auth";
import { isPaidSubscriber } from "@/app/lib/subscription";
import { db } from "@/app/db";
import {
  projectCollaborators,
  projects,
  users,
} from "@/app/db/schema";

export const dynamic = "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type CollaboratorRow = {
  id: string;
  projectId: string;
  invitedEmail: string;
  status: string;
  createdAt: Date;
  acceptedAt: Date | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
};

type SharedRow = {
  projectId: string;
  projectName: string;
  projectDomain: string;
  acceptedAt: Date | null;
};

/* =========================================================
   HELPERS
========================================================= */

function statusBadgeClass(status: string): string {
  switch (status) {
    case "accepted":
      return "stripe-badge stripe-badge-success";
    case "revoked":
      return "stripe-badge stripe-badge-neutral";
    default:
      return "stripe-badge stripe-badge-warning";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "accepted":
      return "Accepted";
    case "revoked":
      return "Revoked";
    default:
      return "Pending";
  }
}

/* =========================================================
   PAGE
========================================================= */

export default async function TeamPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const isPaid = await isPaidSubscriber(user.id);

  /* ---------------------------------------------------------
     1) My projects + their collaborators
  --------------------------------------------------------- */

  const myProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      domain: projects.domain,
      isActive: projects.isActive,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(eq(projects.userId, user.id))
    .orderBy(desc(projects.createdAt));

  const projectIds = myProjects.map((p) => p.id);

  let collaboratorsByProject: Record<string, CollaboratorRow[]> = {};

  if (projectIds.length > 0) {
    const rows = await db
      .select({
        id: projectCollaborators.id,
        projectId: projectCollaborators.projectId,
        invitedEmail: projectCollaborators.invitedEmail,
        status: projectCollaborators.status,
        createdAt: projectCollaborators.createdAt,
        acceptedAt: projectCollaborators.acceptedAt,
        userId: projectCollaborators.userId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(projectCollaborators)
      .leftJoin(users, eq(projectCollaborators.userId, users.id))
      .where(inArray(projectCollaborators.projectId, projectIds))
      .orderBy(desc(projectCollaborators.createdAt));

    collaboratorsByProject = rows.reduce<
      Record<string, CollaboratorRow[]>
    >((acc, row) => {
      const bucket = acc[row.projectId] ?? (acc[row.projectId] = []);
      bucket.push(row);
      return acc;
    }, {});
  }

  /* ---------------------------------------------------------
     2) Projects shared with me (where I'm a collaborator)
  --------------------------------------------------------- */

  const sharedRows = await db
    .select({
      projectId: projects.id,
      projectName: projects.name,
      projectDomain: projects.domain,
      acceptedAt: projectCollaborators.acceptedAt,
    })
    .from(projectCollaborators)
    .innerJoin(
      projects,
      eq(projectCollaborators.projectId, projects.id)
    )
    .where(
      and(
        eq(projectCollaborators.userId, user.id),
        eq(projectCollaborators.status, "accepted")
      )
    )
    .orderBy(desc(projectCollaborators.acceptedAt));

  const totalCollaborators = Object.values(
    collaboratorsByProject
  ).reduce((sum, rows) => sum + rows.length, 0);

  /* ---------------------------------------------------------
     3) Empty state: no owned projects and no shared projects
  --------------------------------------------------------- */

  const isEmpty =
    myProjects.length === 0 && sharedRows.length === 0;

  /* ---------------------------------------------------------
     Render
  --------------------------------------------------------- */

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="eyebrow mb-1">Team</div>
          <h1 className="page-title">Team access</h1>
          <p className="page-subtitle">
            {myProjects.length === 0 && sharedRows.length === 0
              ? "Invite collaborators to your projects, or view projects shared with you."
              : myProjects.length === 0
                ? `You have access to ${sharedRows.length} shared ${
                    sharedRows.length === 1 ? "project" : "projects"
                  }.`
                : `${totalCollaborators} collaborator${
                    totalCollaborators === 1 ? "" : "s"
                  } across ${myProjects.length} ${
                    myProjects.length === 1 ? "project" : "projects"
                  }.`}
          </p>
        </div>

        {!isPaid && (
          <Link
            href="/dashboard/subscription"
            className="btn-stripe btn-stripe-primary self-start"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Upgrade to invite</span>
          </Link>
        )}
      </div>

      {/* Paid feature banner (free plan) */}
      {!isPaid && (
        <div className="stripe-alert stripe-alert-info">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, marginTop: 1 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div>
            <div className="font-semibold">
              Project sharing is a paid feature
            </div>
            <div className="mt-0.5">
              Upgrade to a paid plan to invite collaborators to your
              projects. Projects shared with you by others are always
              visible here.
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {isEmpty ? (
        <section className="stripe-panel">
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>

            <h2 className="section-title mb-2">No team activity yet</h2>
            <p
              className="mb-6 max-w-md text-sm leading-6"
              style={{ color: "var(--text-muted)" }}
            >
              Once you have projects, you can invite people to
              view their audits and reports. Projects shared with
              you by others will also appear here.
            </p>

            <Link
              href="/dashboard/projects"
              className="btn-stripe btn-stripe-primary"
            >
              View projects
            </Link>
          </div>
        </section>
      ) : (
        <>
          {/* =====================================================
              MY PROJECTS + COLLABORATORS
          ====================================================== */}
          {myProjects.length > 0 && (
            <section className="flex flex-col gap-4">
              <div>
                <h2 className="section-title">My projects</h2>
                <p className="section-description">
                  Manage who has access to each of your projects.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                {myProjects.map((project) => {
                  const collabs =
                    collaboratorsByProject[project.id] ?? [];
                  const acceptedCount = collabs.filter(
                    (c) => c.status === "accepted"
                  ).length;
                  const pendingCount = collabs.filter(
                    (c) => c.status === "pending"
                  ).length;

                  return (
                    <div
                      key={project.id}
                      className="stripe-panel overflow-hidden"
                    >
                      {/* Project header */}
                      <div
                        className="flex flex-col gap-3 border-b px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold"
                            style={{
                              background: "var(--surface-hover, #f1f5f9)",
                              color: "var(--text-primary)",
                            }}
                          >
                            {project.name.charAt(0).toUpperCase()}
                          </span>

                          <div className="min-w-0">
                            <Link
                              href={`/dashboard/projects/${project.id}`}
                              className="block truncate text-sm font-semibold hover:underline"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {project.name}
                            </Link>
                            <div
                              className="truncate text-xs"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {project.domain}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {acceptedCount > 0 && (
                            <span className="stripe-badge stripe-badge-success">
                              {acceptedCount} active
                            </span>
                          )}
                          {pendingCount > 0 && (
                            <span className="stripe-badge stripe-badge-warning">
                              {pendingCount} pending
                            </span>
                          )}

                          <Link
                            href={`/dashboard/projects/${project.id}/settings/team`}
                            className="btn-stripe btn-stripe-secondary"
                          >
                            Manage
                          </Link>
                        </div>
                      </div>

                      {/* Collaborator list */}
                      {collabs.length === 0 ? (
                        <div className="px-6 py-6 text-center">
                          <p
                            className="text-sm"
                            style={{ color: "var(--text-muted)" }}
                          >
                            No collaborators yet.{" "}
                            <Link
                              href={`/dashboard/projects/${project.id}/settings/team`}
                              className="stripe-link"
                            >
                              Invite someone →
                            </Link>
                          </p>
                        </div>
                      ) : (
                        <ul
                          className="divide-y"
                          style={{
                            borderColor: "var(--border-light)",
                          }}
                        >
                          {collabs.map((c) => {
                            const displayName =
                              c.userName?.trim() ||
                              c.userEmail ||
                              c.invitedEmail;

                            return (
                              <li
                                key={c.id}
                                className="flex items-center justify-between gap-3 px-6 py-3"
                              >
                                <div className="flex items-center gap-3">
                                  <span
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                    style={{
                                      background: "var(--text-muted)",
                                    }}
                                    aria-hidden="true"
                                  >
                                    {displayName
                                      .charAt(0)
                                      .toUpperCase()}
                                  </span>

                                  <div className="min-w-0">
                                    <div
                                      className="truncate text-sm font-medium"
                                      style={{
                                        color: "var(--text-primary)",
                                      }}
                                    >
                                      {displayName}
                                    </div>
                                    {c.userName?.trim() &&
                                      c.userEmail && (
                                        <div
                                          className="truncate text-xs"
                                          style={{
                                            color: "var(--text-muted)",
                                          }}
                                        >
                                          {c.userEmail}
                                        </div>
                                      )}
                                  </div>
                                </div>

                                <span
                                  className={statusBadgeClass(c.status)}
                                >
                                  {statusLabel(c.status)}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* =====================================================
              SHARED WITH ME
          ====================================================== */}
          {sharedRows.length > 0 && (
            <section className="flex flex-col gap-4">
              <div>
                <h2 className="section-title">Shared with me</h2>
                <p className="section-description">
                  Projects other people have given you view-only
                  access to.
                </p>
              </div>

              <div className="stripe-panel overflow-hidden">
                <ul className="divide-y" style={{ borderColor: "var(--border-light)" }}>
                  {sharedRows.map((row) => (
                    <li key={row.projectId}>
                      <Link
                        href={`/dashboard/projects/${row.projectId}`}
                        className="flex items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold"
                            style={{
                              background: "var(--surface-hover, #f1f5f9)",
                              color: "var(--text-primary)",
                            }}
                          >
                            {row.projectName.charAt(0).toUpperCase()}
                          </span>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="truncate text-sm font-medium"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {row.projectName}
                              </span>
                              <span
                                className="rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                                style={{
                                  borderColor: "var(--border)",
                                  color: "var(--text-muted)",
                                }}
                              >
                                View only
                              </span>
                            </div>
                            <div
                              className="truncate text-xs"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {row.projectDomain}
                            </div>
                          </div>
                        </div>

                        <span
                          className="text-sm"
                          style={{ color: "var(--text-muted)" }}
                          aria-hidden="true"
                        >
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}