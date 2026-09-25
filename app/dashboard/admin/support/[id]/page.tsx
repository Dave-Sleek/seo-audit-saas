// app/dashboard/admin/support/[id]/page.tsx

import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { db } from "@/app/db";
import {
  supportTickets,
  supportTicketReplies,
  users,
} from "@/app/db/schema";
import AdminTicketActions from "./admin-ticket-actions";
import AdminReplyForm from "./admin-reply-form";

export const dynamic = "force-dynamic";

/* =========================================================
   HELPERS
========================================================= */

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return formatDateTime(date);
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "open":
      return "stripe-badge stripe-badge-info";
    case "pending":
      return "stripe-badge stripe-badge-warning";
    case "resolved":
      return "stripe-badge stripe-badge-success";
    case "closed":
      return "stripe-badge stripe-badge-neutral";
    default:
      return "stripe-badge stripe-badge-neutral";
  }
}

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case "urgent":
      return "stripe-badge stripe-badge-danger";
    case "high":
      return "stripe-badge stripe-badge-warning";
    case "normal":
      return "stripe-badge stripe-badge-neutral";
    case "low":
      return "stripe-badge stripe-badge-neutral";
    default:
      return "stripe-badge stripe-badge-neutral";
  }
}

function categoryLabel(category: string): string {
  switch (category) {
    case "bug":
      return "Bug report";
    case "billing":
      return "Billing";
    case "feature":
      return "Feature request";
    default:
      return "Other";
  }
}

/* =========================================================
   PAGE
========================================================= */

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  /* ---------- Load ticket + author ---------- */

  const [row] = await db
    .select({
      id: supportTickets.id,
      reference: supportTickets.reference,
      subject: supportTickets.subject,
      body: supportTickets.body,
      category: supportTickets.category,
      status: supportTickets.status,
      priority: supportTickets.priority,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
      lastReplyAt: supportTickets.lastReplyAt,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(supportTickets)
    .innerJoin(users, eq(supportTickets.userId, users.id))
    .where(eq(supportTickets.id, id))
    .limit(1);

  if (!row) {
    notFound();
  }

  /* ---------- Load replies ---------- */

  const replies = await db
    .select({
      id: supportTicketReplies.id,
      body: supportTicketReplies.body,
      authorRole: supportTicketReplies.authorRole,
      createdAt: supportTicketReplies.createdAt,
      author: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(supportTicketReplies)
    .innerJoin(users, eq(supportTicketReplies.authorId, users.id))
    .where(eq(supportTicketReplies.ticketId, row.id))
    .orderBy(asc(supportTicketReplies.createdAt));

  const isClosed = row.status === "closed";
  const displayName = row.user.name?.trim() || row.user.email;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <nav className="breadcrumbs mb-3" aria-label="Breadcrumb">
            <Link href="/dashboard/admin">Admin</Link>
            <span className="breadcrumb-separator">/</span>
            <Link href="/dashboard/admin/support">Support</Link>
            <span className="breadcrumb-separator">/</span>
            <span className="font-mono text-slate-900">
              {row.reference}
            </span>
          </nav>

          <div className="eyebrow mb-1">
            {categoryLabel(row.category)}
          </div>
          <h1 className="page-title break-words">{row.subject}</h1>
          <p className="page-subtitle">
            Opened {formatRelative(row.createdAt)} by {displayName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          <span className={priorityBadgeClass(row.priority)}>
            {row.priority.charAt(0).toUpperCase() + row.priority.slice(1)}
          </span>
          <span className={statusBadgeClass(row.status)}>
            {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
          </span>

          <Link
            href="/dashboard/admin/support"
            className="btn-stripe btn-stripe-secondary"
          >
            Back to queue
          </Link>
        </div>
      </div>

      {/* Action bar */}
      <AdminTicketActions
        ticketId={row.id}
        status={row.status}
        priority={row.priority}
      />

      {/* Original message */}
      <section className="stripe-panel">
        <div
          className="flex items-center gap-3 border-b px-6 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ background: "var(--text-muted)" }}
            aria-hidden="true"
          >
            {displayName.charAt(0).toUpperCase()}
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {displayName}
            </div>
            <div
              className="text-xs text-slate-500"
              title={formatDateTime(row.createdAt)}
            >
              {row.user.email} · {formatRelative(row.createdAt)}
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {row.body}
          </p>
        </div>
      </section>

      {/* Reply thread */}
      {replies.length > 0 && (
        <section className="flex flex-col gap-3">
          {replies.map((reply) => {
            const isAdmin = reply.authorRole === "admin";
            const replyName =
              reply.author.name?.trim() || reply.author.email;

            return (
              <div
                key={reply.id}
                className="stripe-panel"
                style={
                  isAdmin
                    ? {
                        borderColor: "var(--primary)",
                        background: "var(--primary-light)",
                      }
                    : undefined
                }
              >
                <div
                  className="flex items-center gap-3 border-b px-6 py-4"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{
                      background: isAdmin
                        ? "var(--primary)"
                        : "var(--text-muted)",
                    }}
                    aria-hidden="true"
                  >
                    {replyName.charAt(0).toUpperCase()}
                  </span>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {replyName}
                      </span>
                      {isAdmin ? (
                        <span className="stripe-badge stripe-badge-info">
                          Support team
                        </span>
                      ) : (
                        <span className="stripe-badge stripe-badge-neutral">
                          Customer
                        </span>
                      )}
                    </div>
                    <div
                      className="text-xs text-slate-500"
                      title={formatDateTime(reply.createdAt)}
                    >
                      {formatRelative(reply.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="px-6 py-5">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {reply.body}
                  </p>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Reply form */}
      {isClosed ? (
        <section className="stripe-panel">
          <div className="px-6 py-6 text-center">
            <p className="text-sm text-slate-500">
              This ticket is closed. Reopen it from the action bar
              above to reply.
            </p>
          </div>
        </section>
      ) : (
        <section className="stripe-panel">
          <div className="px-6 py-6">
            <AdminReplyForm ticketId={row.id} />
          </div>
        </section>
      )}
    </div>
  );
}