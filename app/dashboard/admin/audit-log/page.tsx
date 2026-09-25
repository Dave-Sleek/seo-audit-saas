// app/dashboard/admin/audit-log/page.tsx

import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import { auditLog, users } from "@/app/db/schema";
import { getEventDisplay } from "@/app/lib/audit-events";
import { buildAuditLogWhere } from "@/app/lib/audit-log-filters";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/* =========================================================
   TYPES
========================================================= */

type SearchParams = {
  q?: string;
  eventType?: string;
  severity?: string;
  from?: string;
  to?: string;
  page?: string;
};

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
    second: "2-digit",
  }).format(date);
}

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "critical") {
    return (
      <span className="stripe-badge stripe-badge-danger">
        Critical
      </span>
    );
  }

  if (severity === "warning") {
    return (
      <span className="stripe-badge stripe-badge-warning">
        Warning
      </span>
    );
  }

  return (
    <span className="stripe-badge stripe-badge-neutral">
      Info
    </span>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  /* ---------- Admin guard ---------- */

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  /* ---------- Filters ---------- */

  const params = await searchParams;

  const currentPage = Math.max(
    1,
    parseInt(params.page ?? "1", 10) || 1
  );
  const offset = (currentPage - 1) * PAGE_SIZE;

  const where = buildAuditLogWhere(params);

  /* ---------- Fetch rows ---------- */

  const rows = await db
    .select({
      event: auditLog,
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
      },
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.userId, users.id))
    .where(where)
    .orderBy(desc(auditLog.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  /* ---------- Total count (for header subtitle) ---------- */

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.userId, users.id))
    .where(where);

  /* ---------- Available event types ---------- */

  const eventTypes = await db
    .selectDistinct({ eventType: auditLog.eventType })
    .from(auditLog)
    .orderBy(auditLog.eventType);

  /* ---------- Pagination ---------- */

  const hasMore = rows.length === PAGE_SIZE;
  const hasPrev = currentPage > 1;

  /* ---------- Export URL (preserves filters) ---------- */

  const exportQs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") {
      exportQs.set(key, String(value));
    }
  }
  const exportHref = `/api/admin/audit-log/export${
    exportQs.toString() ? `?${exportQs.toString()}` : ""
  }`;

  /* ---------- Helpers ---------- */

  function buildQuery(
    overrides: Partial<SearchParams>
  ): string {
    const next: SearchParams = { ...params, ...overrides };
    const qs = new URLSearchParams();

    for (const [key, value] of Object.entries(next)) {
      if (value) qs.set(key, String(value));
    }

    const s = qs.toString();
    return s ? `?${s}` : "";
  }

  const hasFilters =
    !!params.q ||
    !!params.eventType ||
    !!params.severity ||
    !!params.from ||
    !!params.to;

  /* ---------- Render ---------- */

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="eyebrow mb-1">Admin</div>
          <h1 className="page-title">Audit log</h1>
          <p className="page-subtitle">
            {hasFilters
              ? `${total.toLocaleString()} ${
                  total === 1 ? "event" : "events"
                } match these filters.`
              : `A record of ${total.toLocaleString()} security-relevant ${
                  total === 1 ? "event" : "events"
                } across all accounts.`}
          </p>
        </div>

        <a
          href={exportHref}
          className="btn-stripe btn-stripe-secondary inline-flex items-center gap-2 self-start"
          // "download" hint is ignored cross-origin, but same-origin it works.
          download
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>Export CSV</span>
        </a>
      </div>

      {/* Filters */}
      <section className="stripe-panel px-5 py-4">
        <form
          method="get"
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex flex-col gap-1">
            <label
              htmlFor="q"
              className="text-xs font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Search
            </label>
            <input
              id="q"
              name="q"
              type="text"
              defaultValue={params.q ?? ""}
              placeholder="Email, name, or IP"
              className="stripe-input"
              style={{ minWidth: 220 }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="eventType"
              className="text-xs font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Event
            </label>
            <select
              id="eventType"
              name="eventType"
              defaultValue={params.eventType ?? ""}
              className="stripe-select"
            >
              <option value="">All events</option>
              {eventTypes.map((et) => (
                <option key={et.eventType} value={et.eventType}>
                  {et.eventType}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="severity"
              className="text-xs font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Severity
            </label>
            <select
              id="severity"
              name="severity"
              defaultValue={params.severity ?? ""}
              className="stripe-select"
            >
              <option value="">All severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="from"
              className="text-xs font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              From
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={params.from ?? ""}
              className="stripe-input"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="to"
              className="text-xs font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              To
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={params.to ?? ""}
              className="stripe-input"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="btn-stripe btn-stripe-primary"
            >
              Filter
            </button>

            {hasFilters && (
              <Link
                href="/dashboard/admin/audit-log"
                className="btn-stripe btn-stripe-secondary"
              >
                Clear
              </Link>
            )}
          </div>
        </form>
      </section>

      {/* Table */}
      <section className="stripe-panel overflow-hidden">
        <div className="stripe-table-wrapper" style={{ border: 0, borderRadius: 0 }}>
          <table className="stripe-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Severity</th>
                <th>User</th>
                <th>IP</th>
                <th>Details</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <p
                      className="text-sm"
                      style={{ color: "var(--text-muted)" }}
                    >
                      No events match these filters.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const display = getEventDisplay(
                    row.event.eventType
                  );

                  return (
                    <tr key={row.event.id}>
                      <td>
                        <div
                          className="text-xs"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {formatDateTime(row.event.createdAt)}
                        </div>
                      </td>

                      <td>
                        <div
                          className="text-sm font-medium"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {display.label}
                        </div>
                        <div
                          className="mt-0.5 font-mono text-xs"
                          style={{ color: "var(--text-subtle)" }}
                        >
                          {row.event.eventType}
                        </div>
                      </td>

                      <td>
                        <SeverityBadge
                          severity={row.event.severity}
                        />
                      </td>

                      <td>
                        {row.user?.email ? (
                          <div>
                            <div
                              className="text-sm"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {row.user.email}
                            </div>
                            {row.user.name && (
                              <div
                                className="mt-0.5 text-xs"
                                style={{ color: "var(--text-subtle)" }}
                              >
                                {row.user.name}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span
                            className="text-xs"
                            style={{ color: "var(--text-subtle)" }}
                          >
                            {row.event.userId
                              ? `deleted user (${row.event.userId.slice(0, 8)}…)`
                              : "—"}
                          </span>
                        )}
                      </td>

                      <td>
                        <span
                          className="font-mono text-xs"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {row.event.ipAddress ?? "—"}
                        </span>
                      </td>

                      <td>
                        {Object.keys(row.event.metadata).length >
                        0 ? (
                          <details>
                            <summary
                              className="cursor-pointer text-xs"
                              style={{ color: "var(--primary)" }}
                            >
                              View
                            </summary>
                            <pre
                              className="mt-2 max-w-md overflow-x-auto rounded border p-2 text-xs"
                              style={{
                                borderColor: "var(--border-light)",
                                background: "var(--surface)",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {JSON.stringify(
                                row.event.metadata,
                                null,
                                2
                              )}
                            </pre>
                          </details>
                        ) : (
                          <span
                            className="text-xs"
                            style={{ color: "var(--text-subtle)" }}
                          >
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pagination */}
      {(hasPrev || hasMore) && (
        <div className="flex items-center justify-between">
          <p
            className="text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Page {currentPage}
            {hasMore ? "" : " (last)"}
          </p>

          <div className="flex items-center gap-2">
            {hasPrev && (
              <Link
                href={`/dashboard/admin/audit-log${buildQuery({
                  page: String(currentPage - 1),
                })}`}
                className="btn-stripe btn-stripe-secondary"
              >
                Previous
              </Link>
            )}

            {hasMore && (
              <Link
                href={`/dashboard/admin/audit-log${buildQuery({
                  page: String(currentPage + 1),
                })}`}
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