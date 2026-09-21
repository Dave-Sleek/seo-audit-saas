import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import { getUsageSummary } from "@/app/lib/usage";

/* =========================================================
   HELPERS
========================================================= */

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function daysUntil(date: Date): number {
  const ms = date.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/* =========================================================
   USAGE BAR
========================================================= */

function UsageBar({
  label,
  used,
  limit,
  hint,
}: {
  label: string;
  used: number;
  limit: number;
  hint?: string;
}) {
  /*
   * Special case: the plan does not include this feature.
   * A limit of 0 means "not available", not "fully used".
   */
  if (limit === 0) {
    return (
      <div
        className="rounded-xl border p-5"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="metric-label">{label}</div>
            <div
              className="mt-2 text-lg font-bold"
              style={{ color: "var(--text-subtle)" }}
            >
              Not included
            </div>
          </div>

          <span className="stripe-badge stripe-badge-neutral">
            Upgrade
          </span>
        </div>

        <p
          className="mt-3 text-xs leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          This feature is not part of your current plan.
        </p>
      </div>
    );
  }

  const percentage =
    limit > 0
      ? Math.min(100, Math.round((used / limit) * 100))
      : 0;

  const remaining = Math.max(0, limit - used);

  const barColor =
    percentage >= 90
      ? "var(--danger)"
      : percentage >= 70
        ? "var(--warning)"
        : "var(--primary)";

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        borderColor: "var(--border)",
        background: "var(--surface)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="metric-label">{label}</div>
          <div className="mt-2 text-lg font-bold tabular-nums">
            <span style={{ color: "var(--text-primary)" }}>
              {formatNumber(used)}
            </span>
            <span
              className="text-sm font-medium"
              style={{ color: "var(--text-subtle)" }}
            >
              {" "}
              / {formatNumber(limit)}
            </span>
          </div>
        </div>

        <span
          className="text-sm font-semibold tabular-nums"
          style={{ color: "var(--text-secondary)" }}
        >
          {percentage}%
        </span>
      </div>

      <div className="stripe-progress mt-4">
        <div
          className="stripe-progress-bar"
          style={{ width: `${percentage}%`, background: barColor }}
        />
      </div>

      <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
        {remaining > 0
          ? `${formatNumber(remaining)} remaining`
          : "None remaining this period"}
        {hint ? ` · ${hint}` : ""}
      </p>
    </div>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default async function SubscriptionPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const summary = await getUsageSummary(user.id);

  console.log(
  "[subscription-debug]",
  JSON.stringify(summary, null, 2)
);

  /* ---------- NO SUBSCRIPTION ---------- */

  if (!summary.subscription || !summary.plan) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <div className="eyebrow mb-1">Account</div>
          <h1 className="page-title">Subscription</h1>
          <p className="page-subtitle">
            Manage your plan and SEO audit usage.
          </p>
        </div>

        <section className="stripe-panel">
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <div
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: "var(--primary-light)" }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--primary)" }}
              >
                <rect x="1" y="4" width="22" height="16" rx="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            </div>

            <h2 className="section-title mb-2">No active subscription</h2>

            <p
              className="mb-6 max-w-md text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              You need an active subscription to run SEO audits. Choose a
              plan to start analyzing websites and managing your SEO
              projects.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/pricing"
                className="btn-stripe btn-stripe-primary"
              >
                Choose a plan
              </Link>

              <Link
                href="/dashboard/projects"
                className="btn-stripe btn-stripe-secondary"
              >
                View projects
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  /* ---------- ACTIVE SUBSCRIPTION ---------- */

  const plan = summary.plan;
  const subscription = summary.subscription;
  const usage = summary.usage;

  const auditsUsed = usage?.auditsUsed ?? 0;
  const pagesCrawled = usage?.pagesCrawled ?? 0;
  const aiRecommendationsUsed = usage?.aiRecommendationsUsed ?? 0;

  const isActive =
    subscription.status === "active" &&
    subscription.endsAt > new Date();

  const daysLeft = daysUntil(subscription.endsAt);
  const expiringSoon =
    isActive && daysLeft > 0 && daysLeft <= 7;
  const expired = !isActive;

  /* ---------- Expiry math for audits hint ---------- */

  const auditsRemaining = Math.max(0, plan.auditLimit - auditsUsed);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="eyebrow mb-1">Account</div>
          <h1 className="page-title">Subscription</h1>
          <p className="page-subtitle">
            Manage your plan and monitor your SEO usage.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/projects"
            className="btn-stripe btn-stripe-secondary"
          >
            Projects
          </Link>

          <Link
            href="/pricing"
            className="btn-stripe btn-stripe-primary"
          >
            Change plan
          </Link>
        </div>
      </div>

      {/* ---------- Expiry warning ---------- */}

      {expiringSoon && (
        <div className="stripe-alert stripe-alert-warning">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, marginTop: 1 }}
            aria-hidden="true"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <div className="font-semibold">
              Your subscription expires in {daysLeft} day
              {daysLeft === 1 ? "" : "s"}
            </div>
            <div className="mt-0.5">
              Renew now to keep running audits without interruption.{" "}
              <Link href="/pricing" className="stripe-link">
                Choose a plan
              </Link>
            </div>
          </div>
        </div>
      )}

      {expired && (
        <div className="stripe-alert stripe-alert-danger">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, marginTop: 1 }}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <div className="font-semibold">
              Your subscription has expired
            </div>
            <div className="mt-0.5">
              Renew to regain access to audits, projects, and AI
              recommendations.{" "}
              <Link href="/pricing" className="stripe-link">
                Choose a plan
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Current plan ---------- */}

      <section className="stripe-panel overflow-hidden">
        <header
          className="border-b px-6 py-6"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-lg"
                  style={{ background: "var(--primary)", color: "#fff" }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2 15.09 8.26 22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </span>

                <div>
                  <div className="metric-label">Current plan</div>
                  <div
                    className="text-2xl font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {plan.name}
                  </div>
                </div>
              </div>
            </div>

            <span
              className={`stripe-badge ${
                isActive
                  ? "stripe-badge-success"
                  : "stripe-badge-danger"
              }`}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: isActive
                    ? "var(--success)"
                    : "var(--danger)",
                }}
                aria-hidden="true"
              />
              {isActive ? "Active" : "Expired"}
            </span>
          </div>
        </header>

        <div
          className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0"
          style={{ borderColor: "var(--border-light)" }}
        >
          <div className="p-6">
            <div className="eyebrow mb-2">Billing</div>
            <div
              className="text-lg font-bold capitalize"
              style={{ color: "var(--text-primary)" }}
            >
              {plan.interval}
            </div>
            <div
              className="mt-1 text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Subscription interval
            </div>
          </div>

          <div className="p-6">
            <div className="eyebrow mb-2">Started</div>
            <div
              className="text-lg font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {formatDate(subscription.startsAt)}
            </div>
            <div
              className="mt-1 text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Current period started
            </div>
          </div>

          <div className="p-6">
            <div className="eyebrow mb-2">
              {isActive ? "Renews / expires" : "Expired"}
            </div>
            <div
              className="text-lg font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {formatDate(subscription.endsAt)}
            </div>
            <div
              className="mt-1 text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              {isActive && daysLeft > 0
                ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining`
                : "Subscription ended"}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Usage ---------- */}

      <section>
        <header className="mb-4">
          <h2 className="section-title">Usage</h2>
          <p className="section-description">
            Your current subscription-period usage.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* SEO audits — this is the primary metric */}
          <UsageBar
            label="SEO audits"
            used={auditsUsed}
            limit={plan.auditLimit}
            hint={
              auditsRemaining > 0 && auditsRemaining <= 5
                ? "Running low"
                : undefined
            }
          />

          {/* Projects — concurrent, not per-period */}
          <UsageBar
            label="Projects"
            used={summary.projectsUsed}
            limit={plan.maxProjects}
            hint="Active projects"
          />

          {/* AI recommendations — 0 means "not included" */}
          <UsageBar
            label="AI recommendations"
            used={aiRecommendationsUsed}
            limit={plan.aiRecommendationLimit}
            hint={
              plan.aiRecommendationLimit > 0
                ? "Per subscription period"
                : undefined
            }
          />

          {/* Pages crawled — reporting metric, no period limit */}
          <div
            className="rounded-xl border p-5"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface)",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="metric-label">Pages crawled</div>
                <div className="mt-2 text-lg font-bold tabular-nums">
                  <span style={{ color: "var(--text-primary)" }}>
                    {formatNumber(pagesCrawled)}
                  </span>
                </div>
              </div>
            </div>

            <p
              className="mt-3 text-xs leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              Cumulative across all audits this period. Each audit is
              limited to{" "}
              <strong style={{ color: "var(--text-secondary)" }}>
                {formatNumber(plan.pagesPerAudit)}
              </strong>{" "}
              pages.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Plan limits ---------- */}

      <section>
        <header className="mb-4">
          <h2 className="section-title">Plan limits</h2>
          <p className="section-description">
            Features included with your current plan.
          </p>
        </header>

        <div className="stripe-panel overflow-hidden">
          <div
            className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0"
            style={{ borderColor: "var(--border-light)" }}
          >
            <div className="flex items-center justify-between p-5">
              <span
                className="text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                Audits per period
              </span>
              <span
                className="text-sm font-semibold tabular-nums"
                style={{ color: "var(--text-primary)" }}
              >
                {formatNumber(plan.auditLimit)}
              </span>
            </div>

            <div className="flex items-center justify-between p-5">
              <span
                className="text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                Pages per audit
              </span>
              <span
                className="text-sm font-semibold tabular-nums"
                style={{ color: "var(--text-primary)" }}
              >
                {formatNumber(plan.pagesPerAudit)}
              </span>
            </div>

            <div className="flex items-center justify-between p-5">
              <span
                className="text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                Maximum projects
              </span>
              <span
                className="text-sm font-semibold tabular-nums"
                style={{ color: "var(--text-primary)" }}
              >
                {formatNumber(plan.maxProjects)}
              </span>
            </div>

            <div className="flex items-center justify-between p-5">
              <span
                className="text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                AI recommendations
              </span>
              <span
                className="text-sm font-semibold tabular-nums"
                style={{ color: "var(--text-primary)" }}
              >
                {plan.aiRecommendationLimit === 0
                  ? "Not included"
                  : formatNumber(plan.aiRecommendationLimit)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Upgrade CTA ---------- */}

      <section className="stripe-panel">
        <div className="flex flex-col gap-5 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="section-title">Need more capacity?</h2>
            <p className="section-description">
              Upgrade your plan to increase your audit, project, page,
              and AI recommendation limits.
            </p>
          </div>

          <Link
            href="/pricing"
            className="btn-stripe btn-stripe-primary shrink-0"
          >
            Compare plans
          </Link>
        </div>
      </section>
    </div>
  );
}
