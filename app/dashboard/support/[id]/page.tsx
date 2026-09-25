// app/dashboard/support/[id]/page.tsx

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import {
  supportTickets,
  supportTicketReplies,
  users,
} from "@/app/db/schema";
import TicketReplyForm from "./ticket-reply-form";

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

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  /* ---------- Load ticket (ownership check) ---------- */

  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.id, id),
        eq(supportTickets.userId, user.id)
      )
    )
    .limit(1);

  if (!ticket) {
    notFound();
  }

  /* ---------- Load replies with author info ---------- */

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
    .where(eq(supportTicketReplies.ticketId, ticket.id))
    .orderBy(asc(supportTicketReplies.createdAt));

  const isClosed = ticket.status === "closed";

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <nav className="breadcrumbs mb-3" aria-label="Breadcrumb">
            <Link href="/dashboard">Dashboard</Link>
            <span className="breadcrumb-separator">/</span>
            <Link href="/dashboard/support">Support</Link>
            <span className="breadcrumb-separator">/</span>
            <span className="font-mono text-slate-900">
              {ticket.reference}
            </span>
          </nav>

          <div className="eyebrow mb-1">
            {categoryLabel(ticket.category)}
          </div>
          <h1 className="page-title break-words">{ticket.subject}</h1>
          <p className="page-subtitle">
            Opened {formatRelative(ticket.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start">
          <span className={statusBadgeClass(ticket.status)}>
            {ticket.status.charAt(0).toUpperCase() +
              ticket.status.slice(1)}
          </span>

          <Link
            href="/dashboard/support"
            className="btn-stripe btn-stripe-secondary"
          >
            All tickets
          </Link>
        </div>
      </div>

      {/* Original message */}
      <section className="stripe-panel">
        <div className="border-b px-6 py-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: "var(--primary)" }}
              aria-hidden="true"
            >
              {(user.name?.trim() || user.email)
                .charAt(0)
                .toUpperCase()}
            </span>
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {user.name?.trim() || user.email}
              </div>
              <div className="text-xs text-slate-500" title={formatDateTime(ticket.createdAt)}>
                {formatRelative(ticket.createdAt)}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {ticket.body}
          </p>
        </div>
      </section>

      {/* Reply thread */}
      {replies.length > 0 && (
        <section className="flex flex-col gap-3">
          {replies.map((reply) => {
            const isAdmin = reply.authorRole === "admin";
            const displayName =
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
                    {displayName.charAt(0).toUpperCase()}
                  </span>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {displayName}
                      </span>
                      {isAdmin && (
                        <span className="stripe-badge stripe-badge-info">
                          Support team
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
              This ticket is closed. If you still need help,{" "}
              <Link
                href="/dashboard/support/new"
                className="stripe-link"
              >
                submit a new ticket
              </Link>
              .
            </p>
          </div>
        </section>
      ) : (
        <section className="stripe-panel">
          <div className="px-6 py-6">
            <TicketReplyForm ticketId={ticket.id} />
          </div>
        </section>
      )}
    </div>
  );
}