import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/app/db";
import { plans } from "@/app/db/schema";

import PlanForm from "../plan-form";

/* =========================================================
   PAGE
========================================================= */

export default async function EditPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, id))
    .limit(1);

  if (!plan) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Back */}
      <Link
        href="/dashboard/admin/plans"
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-slate-900"
        style={{ color: "var(--text-muted)" }}
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
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to plans
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="eyebrow mb-1">Admin</div>
          <h1 className="page-title">{plan.name}</h1>
          <p className="page-subtitle">
            Editing plan{" "}
            <code
              className="rounded px-1.5 py-0.5 font-mono text-xs"
              style={{ background: "var(--border-light)" }}
            >
              {plan.slug}
            </code>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
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
            <span className="stripe-badge stripe-badge-info">Featured</span>
          )}
        </div>
      </div>

      {/* Form */}
      <PlanForm
        mode="edit"
        initial={{
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          description: plan.description ?? "",
          price: plan.price,
          currency: plan.currency,
          interval: plan.interval,
          auditLimit: plan.auditLimit,
          pagesPerAudit: plan.pagesPerAudit,
          aiRecommendationLimit: plan.aiRecommendationLimit,
          maxProjects: plan.maxProjects,
          isActive: plan.isActive,
          isFeatured: plan.isFeatured,
          paystackPlanCode: plan.paystackPlanCode ?? "",
        }}
      />
    </div>
  );
}