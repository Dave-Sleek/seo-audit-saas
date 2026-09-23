import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import {
  payments,
  plans,
  subscriptions,
  users,
} from "@/app/db/schema";

/* =========================================================
   HELPERS
========================================================= */

/**
 * Format a Paystack amount for display.
 *
 * `amount` is always in the smallest currency unit
 * (kobo for NGN, cents for USD). Most currencies use
 * 100 subunits, so we divide by 100. A few do not (JPY,
 * KRW, VND) and those are passed through unchanged.
 *
 * Example: 500000 NGN kobo -> "₦5,000.00"
 */
function formatMoney(amount: number, currency: string): string {
  const zeroDecimal = ["JPY", "KRW", "VND"].includes(currency);
  const major = zeroDecimal ? amount : amount / 100;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: zeroDecimal ? 0 : 2,
    maximumFractionDigits: zeroDecimal ? 0 : 2,
  }).format(major);
}

function formatDate(date: Date): string {
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
  return formatDate(date);
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "successful":
      return "stripe-badge stripe-badge-success";
    case "failed":
      return "stripe-badge stripe-badge-danger";
    case "pending":
      return "stripe-badge stripe-badge-warning";
    case "refunded":
      return "stripe-badge stripe-badge-neutral";
    default:
      return "stripe-badge stripe-badge-neutral";
  }
}

/* =========================================================
   TYPES
========================================================= */

type SearchParams = {
  status?: string;
  planId?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: string;
};

const PAGE_SIZE = 25;

/* =========================================================
   PAGE
========================================================= */

export default async function AdminPaymentsPage({
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

  /* ---------- Parse filters ---------- */

  const params = await searchParams;

  const currentPage = Math.max(
    1,
    parseInt(params.page ?? "1", 10) || 1
  );
  const offset = (currentPage - 1) * PAGE_SIZE;

  const conditions = [];

  if (params.status) {
    conditions.push(eq(payments.status, params.status));
  }

  if (params.planId) {
    conditions.push(
      sql`${payments.metadata}->>'planId' = ${params.planId}`
    );
  }

  if (params.from) {
    const fromDate = new Date(params.from);
    if (!Number.isNaN(fromDate.getTime())) {
      conditions.push(gte(payments.createdAt, fromDate));
    }
  }

  if (params.to) {
    const toDate = new Date(params.to);
    if (!Number.isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(payments.createdAt, toDate));
    }
  }

  if (params.q) {
    const q = `%${params.q.trim()}%`;
    conditions.push(
      or(
        ilike(users.email, q),
        ilike(payments.reference, q)
      )
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;

  /* ---------- Fetch rows ---------- */

  const rows = await db
    .select({
      id: payments.id,
      reference: payments.reference,
      status: payments.status,
      amount: payments.amount,
      currency: payments.currency,
      createdAt: payments.createdAt,
      paidAt: payments.paidAt,
      subscriptionId: payments.subscriptionId,
      userEmail: users.email,
      userId: users.id,
      planId: sql<string | null>`${payments.metadata}->>'planId'`,
      planName: plans.name,
    })
    .from(payments)
    .innerJoin(users, eq(payments.userId, users.id))
    .leftJoin(
      plans,
      /*
       * plans.id is uuid, metadata->>'planId' is text.
       * Postgres will not compare them without an explicit cast.
       * This was causing the "Failed query" error.
       */
      sql`${plans.id} = (${payments.metadata}->>'planId')::uuid`
    )
    .where(where)
    .orderBy(desc(payments.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  /* ---------- Stats (last 30 days) ---------- */

  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  );

  const [paymentStats] = await db
    .select({
      /*
       * amount is numeric(12,2). SUM returns numeric which the
       * driver returns as a string, so cast to float for JS.
       * COUNT(*) returns bigint, also cast to int.
       *
       * The sum is in kobo (smallest unit), and formatMoney
       * divides by 100 on display.
       */
      totalRevenue: sql<number>`COALESCE(SUM(${payments.amount}) FILTER (WHERE ${payments.status} = 'successful'), 0)::float`,
      successfulCount: sql<number>`COUNT(*) FILTER (WHERE ${payments.status} = 'successful')::int`,
      failedCount: sql<number>`COUNT(*) FILTER (WHERE ${payments.status} = 'failed')::int`,
      pendingCount: sql<number>`COUNT(*) FILTER (WHERE ${payments.status} = 'pending')::int`,
    })
    .from(payments)
    .where(gte(payments.createdAt, thirtyDaysAgo));

  const [subStats] = await db
    .select({
      activeSubscriptions: sql<number>`COUNT(*) FILTER (WHERE ${subscriptions.status} IN ('active', 'non_renewing') AND ${subscriptions.endsAt} > now())::int`,
      newSubscriptions: sql<number>`COUNT(*) FILTER (WHERE ${subscriptions.createdAt} >= ${thirtyDaysAgo})::int`,
    })
    .from(subscriptions);

  /* ---------- Plan filter options ---------- */

  const planOptions = await db
    .select({
      id: plans.id,
      name: plans.name,
    })
    .from(plans)
    .orderBy(plans.name);

  /* ---------- Pagination ---------- */

  const hasMore = rows.length === PAGE_SIZE;
  const hasPrev = currentPage > 1;

  function buildQuery(overrides: Partial<SearchParams>): string {
    const next: SearchParams = { ...params, ...overrides };
    const qs = new URLSearchParams();

    for (const [key, value] of Object.entries(next)) {
      if (value) qs.set(key, String(value));
    }

    const s = qs.toString();
    return s ? `?${s}` : "";
  }

  /* ---------- Render ---------- */

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="eyebrow mb-1">Admin</div>
        <h1 className="page-title">Payments</h1>
        <p className="page-subtitle">
          Monitor transactions and subscriptions.
        </p>
      </div>

      {/* Stats strip */}
      <section>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="Revenue (30d)"
            value={formatMoney(
              Number(paymentStats?.totalRevenue ?? 0),
              "NGN"
            )}
            tone="primary"
          />
          <StatCard
            label="Successful"
            value={String(paymentStats?.successfulCount ?? 0)}
            tone="success"
          />
          <StatCard
            label="Failed"
            value={String(paymentStats?.failedCount ?? 0)}
            tone="danger"
          />
          <StatCard
            label="Pending"
            value={String(paymentStats?.pendingCount ?? 0)}
            tone="warning"
          />
          <StatCard
            label="Active subs"
            value={String(subStats?.activeSubscriptions ?? 0)}
          />
          <StatCard
            label="New subs (30d)"
            value={String(subStats?.newSubscriptions ?? 0)}
          />
        </div>
      </section>

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
              placeholder="Email or reference"
              className="stripe-input"
              style={{ minWidth: 220 }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="status"
              className="text-xs font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={params.status ?? ""}
              className="stripe-select"
            >
              <option value="">All statuses</option>
              <option value="successful">Successful</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="planId"
              className="text-xs font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Plan
            </label>
            <select
              id="planId"
              name="planId"
              defaultValue={params.planId ?? ""}
              className="stripe-select"
            >
              <option value="">All plans</option>
              {planOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
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

            {(params.q ||
              params.status ||
              params.planId ||
              params.from ||
              params.to) && (
              <Link
                href="/dashboard/admin/payments"
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
        <div
          className="stripe-table-wrapper"
          style={{ border: 0, borderRadius: 0 }}
        >
          <table className="stripe-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Customer</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Subscription</th>
                <th
                  style={{ textAlign: "right" }}
                  aria-label="Actions"
                />
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">
                    <p
                      className="text-sm"
                      style={{ color: "var(--text-muted)" }}
                    >
                      No payments match these filters.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div
                        className="text-sm"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {formatRelative(row.createdAt)}
                      </div>
                      <div
                        className="mt-0.5 text-xs"
                        style={{ color: "var(--text-subtle)" }}
                      >
                        {formatDate(row.createdAt)}
                      </div>
                    </td>

                    <td>
                      <span
                        className="font-mono text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {row.reference}
                      </span>
                    </td>

                    <td>
                      <div
                        className="text-sm"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {row.userEmail}
                      </div>
                    </td>

                    <td>
                      <span
                        className="text-sm"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {row.planName ?? "—"}
                      </span>
                    </td>

                    <td>
                      <span
                        className="text-sm font-semibold tabular-nums"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {formatMoney(
                          Number(row.amount),
                          row.currency
                        )}
                      </span>
                    </td>

                    <td>
                      <span className={statusBadgeClass(row.status)}>
                        {row.status.charAt(0).toUpperCase() +
                          row.status.slice(1)}
                      </span>
                    </td>

                    <td>
                      {row.subscriptionId ? (
                        <span
                          className="font-mono text-xs"
                          style={{ color: "var(--text-subtle)" }}
                          title={row.subscriptionId}
                        >
                          {row.subscriptionId.slice(0, 8)}…
                        </span>
                      ) : (
                        <span
                          className="text-xs"
                          style={{ color: "var(--text-subtle)" }}
                        >
                          —
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: "right" }}>
                        <Link
                            href={`/dashboard/admin/payments/${row.id}`}
                            className="btn-stripe btn-stripe-secondary">
                            View
                        </Link>
                        </td>
                  </tr>
                ))
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
                href={`/dashboard/admin/payments${buildQuery({
                  page: String(currentPage - 1),
                })}`}
                className="btn-stripe btn-stripe-secondary"
              >
                Previous
              </Link>
            )}

            {hasMore && (
              <Link
                href={`/dashboard/admin/payments${buildQuery({
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

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "primary" | "success" | "danger" | "warning";
}) {
  const colors: Record<
    typeof tone,
    { color: string; bg: string }
  > = {
    default: { color: "var(--text-primary)", bg: "var(--surface)" },
    primary: { color: "var(--primary)", bg: "var(--primary-light)" },
    success: { color: "var(--success)", bg: "var(--success-light)" },
    danger: { color: "var(--danger)", bg: "var(--danger-light)" },
    warning: { color: "var(--warning)", bg: "var(--warning-light)" },
  };

  const c = colors[tone];

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: "var(--border)",
        background: "var(--surface)",
      }}
    >
      <div
        className="metric-label"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div
        className="mt-2 text-xl font-bold tabular-nums"
        style={{ color: c.color }}
      >
        {value}
      </div>
    </div>
  );
}