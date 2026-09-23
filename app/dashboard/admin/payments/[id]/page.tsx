import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";

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
   PAGE
========================================================= */

export default async function AdminPaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  /* ---------- Admin guard ---------- */

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  /* ---------- Load payment ---------- */

  const { id } = await params;

  const [row] = await db
    .select({
      payment: payments,
      user: users,
    })
    .from(payments)
    .innerJoin(users, eq(payments.userId, users.id))
    .where(eq(payments.id, id))
    .limit(1);

  if (!row) {
    notFound();
  }

  const { payment, user: customer } = row;

  /* ---------- Load linked subscription ---------- */

  let subscription = null;
  let plan = null;

  if (payment.subscriptionId) {
    const [subRow] = await db
      .select({
        subscription: subscriptions,
        plan: plans,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.id, payment.subscriptionId))
      .limit(1);

    if (subRow) {
      subscription = subRow.subscription;
      plan = subRow.plan;
    }
  }

  /* ---------- If no subscription, try to resolve plan from metadata ---------- */

  if (!plan) {
    const planId =
      typeof payment.metadata === "object" &&
      payment.metadata !== null &&
      "planId" in payment.metadata
        ? (payment.metadata.planId as string)
        : null;

    if (planId) {
      const [planRow] = await db
        .select()
        .from(plans)
        .where(eq(plans.id, planId))
        .limit(1);

      plan = planRow ?? null;
    }
  }

  const amount = Number(payment.amount);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Link
              href="/dashboard/admin/payments"
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              ← Payments
            </Link>
          </div>

          <div className="eyebrow mb-1">Admin</div>
          <h1 className="page-title">Payment detail</h1>
          <p
            className="mt-1 font-mono text-xs"
            style={{ color: "var(--text-subtle)" }}
          >
            {payment.id}
          </p>
        </div>

        <span
          className={statusBadgeClass(payment.status)}
          style={{ alignSelf: "flex-start" }}
        >
          {payment.status.charAt(0).toUpperCase() +
            payment.status.slice(1)}
        </span>
      </div>

      {/* Summary cards */}
      <section>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div
            className="rounded-xl border p-5"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface)",
            }}
          >
            <div className="metric-label">Amount</div>
            <div
              className="mt-2 text-2xl font-bold tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {formatMoney(amount, payment.currency)}
            </div>
            <div
              className="mt-1 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {payment.currency}
            </div>
          </div>

          <div
            className="rounded-xl border p-5"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface)",
            }}
          >
            <div className="metric-label">Customer</div>
            <div
              className="mt-2 text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {customer.email}
            </div>
            <div
              className="mt-1 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {customer.name}
            </div>
          </div>

          <div
            className="rounded-xl border p-5"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface)",
            }}
          >
            <div className="metric-label">Plan</div>
            <div
              className="mt-2 text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {plan?.name ?? "—"}
            </div>
            {plan && (
              <div
                className="mt-1 text-xs capitalize"
                style={{ color: "var(--text-muted)" }}
              >
                {plan.interval}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Transaction details */}
      <section className="stripe-panel">
        <header
          className="border-b px-6 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="section-title">Transaction</h2>
        </header>

        <dl className="divide-y" style={{ borderColor: "var(--border-light)" }}>
          <DetailRow label="Reference" value={payment.reference} mono />
          <DetailRow
            label="Provider"
            value={payment.provider}
          />
          <DetailRow
            label="Provider transaction ID"
            value={payment.providerTransactionId ?? "—"}
            mono
          />
          <DetailRow
            label="Status"
            value={
              <span className={statusBadgeClass(payment.status)}>
                {payment.status.charAt(0).toUpperCase() +
                  payment.status.slice(1)}
              </span>
            }
          />
          <DetailRow
            label="Created"
            value={formatDateTime(payment.createdAt)}
          />
          <DetailRow
            label="Paid at"
            value={
              payment.paidAt ? formatDateTime(payment.paidAt) : "—"
            }
          />
          <DetailRow
            label="Last updated"
            value={formatDateTime(payment.updatedAt)}
          />
        </dl>
      </section>

      {/* Subscription */}
      <section className="stripe-panel">
        <header
          className="border-b px-6 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="section-title">Subscription</h2>
        </header>

        {subscription ? (
          <dl
            className="divide-y"
            style={{ borderColor: "var(--border-light)" }}
          >
            <DetailRow
              label="Subscription ID"
              value={
                <Link
                  href={`/dashboard/admin/subscriptions/${subscription.id}`}
                  className="stripe-link font-mono text-xs"
                >
                  {subscription.id}
                </Link>
              }
            />
            <DetailRow
              label="Status"
              value={
                <span
                  className={`stripe-badge ${
                    subscription.status === "active"
                      ? "stripe-badge-success"
                      : subscription.status === "non_renewing"
                        ? "stripe-badge-warning"
                        : "stripe-badge-neutral"
                  }`}
                >
                  {subscription.status.replace("_", " ")}
                </span>
              }
            />
            <DetailRow
              label="Started"
              value={formatDateTime(subscription.startsAt)}
            />
            <DetailRow
              label="Ends"
              value={formatDateTime(subscription.endsAt)}
            />
            {subscription.cancelledAt && (
              <DetailRow
                label="Cancelled"
                value={formatDateTime(subscription.cancelledAt)}
              />
            )}
            {subscription.paystackSubscriptionCode && (
              <DetailRow
                label="Paystack subscription"
                value={subscription.paystackSubscriptionCode}
                mono
              />
            )}
            {subscription.paystackCustomerCode && (
              <DetailRow
                label="Paystack customer"
                value={subscription.paystackCustomerCode}
                mono
              />
            )}
          </dl>
        ) : (
          <div className="px-6 py-8 text-center">
            <p
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              This payment is not linked to a subscription.
            </p>
          </div>
        )}
      </section>

      {/* Raw metadata */}
      <section className="stripe-panel">
        <header
          className="border-b px-6 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="section-title">Raw metadata</h2>
          <p
            className="mt-1 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            The exact payload stored on this payment row. Useful for
            debugging webhook issues.
          </p>
        </header>

        <div className="p-6">
          <pre
            className="overflow-x-auto rounded-lg border p-4 text-xs"
            style={{
              borderColor: "var(--border-light)",
              background: "var(--surface-muted, var(--surface))",
              color: "var(--text-secondary)",
            }}
          >
            {JSON.stringify(payment.metadata, null, 2)}
          </pre>
        </div>
      </section>

      {/* Actions */}
      <section className="stripe-panel">
        <div className="flex flex-col gap-5 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="section-title">Actions</h2>
            <p className="section-description">
              Administrative operations for this payment.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/admin/users/${customer.id}`}
              className="btn-stripe btn-stripe-secondary"
            >
              View customer
            </Link>

            {payment.subscriptionId && (
              <Link
                href={`/dashboard/admin/subscriptions/${payment.subscriptionId}`}
                className="btn-stripe btn-stripe-secondary">
                View subscription
              </Link>
            )}

            {/*
             * Refund button intentionally omitted.
             *
             * A refund is a destructive, irreversible operation
             * that touches both Paystack and your DB. Do not
             * ship a refund button until:
             *
             *   1. You have a POST /api/admin/payments/[id]/refund
             *      route that calls Paystack's refund endpoint.
             *   2. You handle the refund webhook (charge.refunded
             *      or refund.processed) to update the payment row.
             *   3. You have an admin_audit_log to record who
             *      triggered the refund and when.
             *
             * Until then, do refunds manually through the
             * Paystack dashboard so the operation is auditable.
             */}
          </div>
        </div>
      </section>
    </div>
  );
}

/* =========================================================
   DETAIL ROW
========================================================= */

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:gap-6">
      <dt
        className="w-48 shrink-0 text-xs font-medium"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </dt>
      <dd
        className={`text-sm ${mono ? "font-mono text-xs" : ""}`}
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </dd>
    </div>
  );
}