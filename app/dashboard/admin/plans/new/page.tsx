import Link from "next/link";

import PlanForm from "../plan-form";

export default function NewPlanPage() {
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
      <div>
        <div className="eyebrow mb-1">Admin</div>
        <h1 className="page-title">Create plan</h1>
        <p className="page-subtitle">
          Add a new subscription plan. Changes take effect immediately.
        </p>
      </div>

      {/* Form */}
      <PlanForm
        mode="create"
        initial={{
          name: "",
          slug: "",
          description: "",
          price: 0,
          currency: "NGN",
          interval: "monthly",
          auditLimit: 5,
          pagesPerAudit: 100,
          aiRecommendationLimit: 0,
          maxProjects: 1,
          isActive: true,
          isFeatured: false,
          paystackPlanCode: "",
        }}
      />
    </div>
  );
}