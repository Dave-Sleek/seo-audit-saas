import Link from "next/link";
import { asc } from "drizzle-orm";

import { db } from "@/app/db";
import { plans } from "@/app/db/schema";

/* =========================================================
   HELPERS
========================================================= */

function formatPrice(price: number, currency: string): string {
  const zeroDecimal = ["JPY", "KRW", "VND"].includes(currency);
  const amount = zeroDecimal ? price : price / 100;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: zeroDecimal ? 0 : 2,
    maximumFractionDigits: zeroDecimal ? 0 : 2,
  }).format(amount);
}

function formatInterval(interval: string): string {
  switch (interval) {
    case "monthly":
      return "Monthly";
    case "yearly":
    case "annually":
      return "Yearly";
    case "forever":
      return "Forever";
    default:
      return interval;
  }
}

/* =========================================================
   PAGE
========================================================= */

export default async function AdminPlansPage() {
  const rows = await db
    .select()
    .from(plans)
    .orderBy(asc(plans.price));

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="eyebrow mb-1">Admin</div>
          <h1 className="page-title">Plans</h1>
          <p className="page-subtitle">
            Manage subscription plans, pricing, and limits.
          </p>
        </div>

        <Link
          href="/dashboard/admin/plans/new"
          className="btn-stripe btn-stripe-primary self-start"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New plan
        </Link>
      </div>

      {/* Table */}
      <section className="stripe-panel overflow-hidden">
        <div
          className="stripe-table-wrapper"
          style={{ border: 0, borderRadius: 0 }}
        >
          <table className="stripe-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Price</th>
                <th>Interval</th>
                <th>Audits</th>
                <th>Pages / audit</th>
                <th>Projects</th>
                <th>AI</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }} aria-label="Actions" />
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center">
                    <p
                      className="text-sm"
                      style={{ color: "var(--text-muted)" }}
                    >
                      No plans yet. Create one to get started.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((plan) => (
                  <tr key={plan.id}>
                    <td>
                      <div
                        className="text-sm font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {plan.name}
                      </div>
                      <div
                        className="mt-0.5 font-mono text-xs"
                        style={{ color: "var(--text-subtle)" }}
                      >
                        {plan.slug}
                      </div>
                    </td>

                    <td>
                      <span
                        className="text-sm font-semibold tabular-nums"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {formatPrice(plan.price, plan.currency)}
                      </span>
                    </td>

                    <td>
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {formatInterval(plan.interval)}
                      </span>
                    </td>

                    <td>
                      <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
                        {plan.auditLimit}
                      </span>
                    </td>

                    <td>
                      <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
                        {plan.pagesPerAudit}
                      </span>
                    </td>

                    <td>
                      <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
                        {plan.maxProjects}
                      </span>
                    </td>

                    <td>
                      <span className="tabular-nums" style={{ color: "var(--text-secondary)" }}>
                        {plan.aiRecommendationLimit}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`stripe-badge ${
                          plan.isActive
                            ? "stripe-badge-success"
                            : "stripe-badge-neutral"
                        }`}
                      >
                        {plan.isActive ? "Active" : "Inactive"}
                      </span>

                      {plan.isFeatured && (
                        <span
                          className="stripe-badge stripe-badge-info ml-2"
                          style={{ marginLeft: 8 }}
                        >
                          Featured
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <Link
                        href={`/dashboard/admin/plans/${plan.id}`}
                        className="btn-stripe btn-stripe-secondary"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}