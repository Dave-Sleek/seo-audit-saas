// app/dashboard/admin/support/page.tsx

import Link from "next/link";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/app/db";
import { supportTickets, users } from "@/app/db/schema";

export const dynamic = "force-dynamic";

/* =========================================================
   CONSTANTS
========================================================= */

const STATUSES = ["open", "pending", "resolved", "closed"] as const;
const CATEGORIES = ["bug", "billing", "feature", "other"] as const;
const PRIORITIES = ["urgent", "high", "normal", "low"] as const;

type Status = (typeof STATUSES)[number];
type Category = (typeof CATEGORIES)[number];
type Priority = (typeof PRIORITIES)[number];

/* =========================================================
   HELPERS
========================================================= */

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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
  return formatDate(date);
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

function isStatus(value: string | undefined): value is Status {
  return !!value && (STATUSES as readonly string[]).includes(value);
}
function isCategory(value: string | undefined): value is Category {
  return !!value && (CATEGORIES as readonly string[]).includes(value);
}
function isPriority(value: string | undefined): value is Priority {
  return !!value && (PRIORITIES as readonly string[]).includes(value);
}

/* =========================================================
   PAGE
========================================================= */

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    category?: string;
    priority?: string;
    q?: string;
  }>;
}) {
  const sp = await searchParams;

  const statusFilter = isStatus(sp.status) ? sp.status : undefined;
  const categoryFilter = isCategory(sp.category) ? sp.category : undefined;
  const priorityFilter = isPriority(sp.priority) ? sp.priority : undefined;
  const query = sp.q?.trim() ?? "";

  /* ---------- Build query ---------- */

  const conditions = [];

  if (statusFilter) {
    conditions.push(eq(supportTickets.status, statusFilter));
  }
  if (categoryFilter) {
    conditions.push(eq(supportTickets.category, categoryFilter));
  }
  if (priorityFilter) {
    conditions.push(eq(supportTickets.priority, priorityFilter));
  }
  if (query.length > 0) {
    const like = `%${query}%`;
    conditions.push(
      or(
        ilike(supportTickets.subject, like),
        ilike(supportTickets.reference, like),
        ilike(users.email, like),
        ilike(users.name, like)
      )
    );
  }

  const rows = await db
    .select({
      id: supportTickets.id,
      reference: supportTickets.reference,
      subject: supportTickets.subject,
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
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(
      // Urgent first, then high, then normal, then low.
      sql`CASE ${supportTickets.priority}
            WHEN 'urgent' THEN 0
            WHEN 'high'   THEN 1
            WHEN 'normal' THEN 2
            WHEN 'low'    THEN 3
            ELSE 4 END`,
      desc(supportTickets.lastReplyAt),
      desc(supportTickets.createdAt)
    )
    .limit(200);

  /* ---------- Counts (unfiltered, for tabs) ---------- */

  const counts = await db
    .select({
      status: supportTickets.status,
      count: sql<number>`count(*)::int`,
    })
    .from(supportTickets)
    .groupBy(supportTickets.status);

  const countByStatus = Object.fromEntries(
    counts.map((c) => [c.status, c.count])
  ) as Record<string, number>;
  const totalCount = counts.reduce((sum, c) => sum + c.count, 0);

  const hasFilters =
    !!statusFilter || !!categoryFilter || !!priorityFilter || query.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="eyebrow mb-1">Admin</div>
          <h1 className="page-title">Support queue</h1>
          <p className="page-subtitle">
            {totalCount === 0
              ? "No tickets yet."
              : `${countByStatus.open ?? 0} open · ${
                  countByStatus.pending ?? 0
                } pending · ${countByStatus.resolved ?? 0} resolved.`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <section className="stripe-panel">
        <form
          method="GET"
          className="flex flex-wrap items-end gap-3 px-6 py-5"
        >
          <div className="min-w-[200px] flex-1">
            <label htmlFor="q" className="stripe-label">
              Search
            </label>
            <input
              id="q"
              name="q"
              type="text"
              defaultValue={query}
              placeholder="Subject, reference, or user email"
              className="stripe-input"
            />
          </div>

          <div className="min-w-[140px]">
            <label htmlFor="status" className="stripe-label">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={statusFilter ?? ""}
              className="stripe-select"
            >
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[140px]">
            <label htmlFor="category" className="stripe-label">
              Category
            </label>
            <select
              id="category"
              name="category"
              defaultValue={categoryFilter ?? ""}
              className="stripe-select"
            >
              <option value="">All</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[140px]">
            <label htmlFor="priority" className="stripe-label">
              Priority
            </label>
            <select
              id="priority"
              name="priority"
              defaultValue={priorityFilter ?? ""}
              className="stripe-select"
            >
              <option value="">All</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="btn-stripe btn-stripe-primary"
            >
              Apply
            </button>
            {hasFilters && (
              <Link
                href="/dashboard/admin/support"
                className="btn-stripe btn-stripe-secondary"
              >
                Clear
              </Link>
            )}
          </div>
        </form>
      </section>

      {/* Table */}
      {rows.length === 0 ? (
        <section className="stripe-panel">
          <div className="px-6 py-16 text-center">
            <h2 className="section-title mb-2">
              {hasFilters ? "No matching tickets" : "No tickets yet"}
            </h2>
            <p
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              {hasFilters
                ? "Try clearing the filters to see more results."
                : "When users submit tickets, they'll show up here."}
            </p>
          </div>
        </section>
      ) : (
        <section className="stripe-panel overflow-hidden">
          <div
            className="stripe-table-wrapper"
            style={{ border: 0, borderRadius: 0 }}
          >
            <table className="stripe-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Subject</th>
                  <th>User</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Last update</th>
                  <th style={{ textAlign: "right" }} aria-label="Actions" />
                </tr>
              </thead>

              <tbody>
                {rows.map((ticket) => {
                  const displayName =
                    ticket.user.name?.trim() || ticket.user.email;

                  return (
                    <tr key={ticket.id}>
                      <td>
                        <span
                          className="font-mono text-xs"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {ticket.reference}
                        </span>
                      </td>

                      <td>
                        <div
                          className="text-sm font-medium"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {ticket.subject}
                        </div>
                        <div
                          className="mt-0.5 text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {categoryLabel(ticket.category)}
                        </div>
                      </td>

                      <td>
                        <div
                          className="text-sm"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {displayName}
                        </div>
                        {ticket.user.name?.trim() && (
                          <div
                            className="text-xs"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {ticket.user.email}
                          </div>
                        )}
                      </td>

                      <td>
                        <span className={priorityBadgeClass(ticket.priority)}>
                          {ticket.priority.charAt(0).toUpperCase() +
                            ticket.priority.slice(1)}
                        </span>
                      </td>

                      <td>
                        <span className={statusBadgeClass(ticket.status)}>
                          {ticket.status.charAt(0).toUpperCase() +
                            ticket.status.slice(1)}
                        </span>
                      </td>

                      <td>
                        <span
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                          title={formatDate(
                            ticket.lastReplyAt ?? ticket.updatedAt
                          )}
                        >
                          {formatRelative(
                            ticket.lastReplyAt ?? ticket.updatedAt
                          )}
                        </span>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <Link
                          href={`/dashboard/admin/support/${ticket.id}`}
                          className="btn-stripe btn-stripe-secondary"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}