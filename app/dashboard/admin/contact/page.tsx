// app/dashboard/admin/contact/page.tsx

import Link from "next/link";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/app/db";
import { contactMessages, users } from "@/app/db/schema";

export const dynamic = "force-dynamic";

const STATUSES = ["unread", "read", "replied", "closed"] as const;
type Status = (typeof STATUSES)[number];

const PAGE_SIZE = 50;

function isStatus(value: string | undefined): value is Status {
  return !!value && (STATUSES as readonly string[]).includes(value);
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

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "unread":
      return "stripe-badge stripe-badge-info";
    case "read":
      return "stripe-badge stripe-badge-neutral";
    case "replied":
      return "stripe-badge stripe-badge-success";
    case "closed":
      return "stripe-badge stripe-badge-neutral";
    default:
      return "stripe-badge stripe-badge-neutral";
  }
}

export default async function AdminContactPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;

  const statusFilter = isStatus(sp.status) ? sp.status : undefined;
  const query = sp.q?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const conditions = [];

  if (statusFilter) {
    conditions.push(eq(contactMessages.status, statusFilter));
  }

  if (query.length > 0) {
    const like = `%${query}%`;
    conditions.push(
      or(
        ilike(contactMessages.name, like),
        ilike(contactMessages.email, like),
        ilike(contactMessages.subject, like)
      )
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      message: contactMessages,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(contactMessages)
    .leftJoin(users, eq(contactMessages.userId, users.id))
    .where(where)
    .orderBy(desc(contactMessages.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  /* ---------- Counts per status (unfiltered, for tabs) ---------- */

  const counts = await db
    .select({
      status: contactMessages.status,
      count: sql<number>`count(*)::int`,
    })
    .from(contactMessages)
    .groupBy(contactMessages.status);

  const countByStatus = Object.fromEntries(
    counts.map((c) => [c.status, c.count])
  ) as Record<string, number>;

  const totalCount = counts.reduce((sum, c) => sum + c.count, 0);

  const hasFilters = !!statusFilter || query.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="eyebrow mb-1">Admin</div>
        <h1 className="page-title">Contact messages</h1>
        <p className="page-subtitle">
          {totalCount === 0
            ? "No contact messages yet."
            : `${countByStatus.unread ?? 0} unread · ${
                countByStatus.replied ?? 0
              } replied · ${countByStatus.closed ?? 0} closed.`}
        </p>
      </div>

      {/* Filters */}
      <section className="stripe-panel">
        <form
          method="GET"
          className="flex flex-wrap items-end gap-3 px-6 py-5"
        >
          <div className="min-w-[240px] flex-1">
            <label htmlFor="q" className="stripe-label">
              Search
            </label>
            <input
              id="q"
              name="q"
              type="text"
              defaultValue={query}
              placeholder="Name, email, or subject"
              className="stripe-input"
            />
          </div>

          <div className="min-w-[160px]">
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

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="btn-stripe btn-stripe-primary"
            >
              Apply
            </button>
            {hasFilters && (
              <Link
                href="/dashboard/admin/contact"
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
              {hasFilters ? "No matching messages" : "No messages yet"}
            </h2>
            <p
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              {hasFilters
                ? "Try clearing the filters."
                : "Messages submitted through the contact form will appear here."}
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
                  <th>From</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Received</th>
                  <th style={{ textAlign: "right" }} aria-label="Actions" />
                </tr>
              </thead>

              <tbody>
                {rows.map(({ message }) => {
                  const displayName =
                    message.name?.trim() || message.email;

                  return (
                    <tr key={message.id}>
                      <td>
                        <div
                          className="text-sm font-medium"
                          style={{
                            color:
                              message.status === "unread"
                                ? "var(--text-primary)"
                                : "var(--text-secondary)",
                          }}
                        >
                          {displayName}
                        </div>
                        <div
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {message.email}
                        </div>
                      </td>

                      <td>
                        <td>
                            <div
                                className="max-w-md truncate text-sm"
                                style={{ color: "var(--text-primary)" }}
                                title={message.subject ?? undefined}
                            >
                                {message.subject ?? "—"}
                            </div>
                            </td>
                      </td>

                      <td>
                        <span className={statusBadgeClass(message.status)}>
                          {message.status.charAt(0).toUpperCase() +
                            message.status.slice(1)}
                        </span>
                      </td>

                      <td>
                        <span
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {formatRelative(message.createdAt)}
                        </span>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <Link
                          href={`/dashboard/admin/contact/${message.id}`}
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

      {/* Pagination */}
      {(page > 1 || rows.length === PAGE_SIZE) && (
        <div className="flex items-center justify-between">
          <p
            className="text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Page {page}
            {rows.length < PAGE_SIZE ? " (last)" : ""}
          </p>

          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link
                href={`/dashboard/admin/contact?${new URLSearchParams({
                  ...(statusFilter ? { status: statusFilter } : {}),
                  ...(query ? { q: query } : {}),
                  page: String(page - 1),
                }).toString()}`}
                className="btn-stripe btn-stripe-secondary"
              >
                Previous
              </Link>
            )}

            {rows.length === PAGE_SIZE && (
              <Link
                href={`/dashboard/admin/contact?${new URLSearchParams({
                  ...(statusFilter ? { status: statusFilter } : {}),
                  ...(query ? { q: query } : {}),
                  page: String(page + 1),
                }).toString()}`}
                className="btn-stripe btn-stripe-secondary"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}