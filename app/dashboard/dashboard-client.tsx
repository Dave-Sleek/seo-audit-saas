"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import AuditForm, {
  type AuditErrorCode,
} from "@/app/components/ui/audit-form";

/* =========================================================
   TYPES
========================================================= */

type User = {
  id: string;
  name?: string | null;
  email: string;
  twoFactorEnabledAt: string | Date | null;
};

type SubscriptionState = {
  hasSubscription: boolean;
  canRunAudit: boolean;
  auditsUsed: number;
  auditLimit: number;
  auditsRemaining: number;
  planName: string | null;
};

type Issue = {
  id?: string;
  pageId?: string;
  url?: string | null;
  category: string;
  type: string;
  severity: string;
  title: string;
  description?: string | null;
  recommendation?: string | null;
};

type AuditPage = {
  id: string;
  url: string;
  statusCode?: number | null;
  score: number | null;
  title?: string | null;
  metaDescription?: string | null;
  issues: Issue[];
};

type Audit = {
  id: string;
  url: string;
  status: string;
  score: number | null;
  pagesCrawled: number | null;
  pagesWithErrors: number | null;
  pagesWithWarnings: number | null;
  pagesPassed: number | null;
  errorMessage?: string | null;
  createdAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
};

type Project = {
  id: string;
  name: string;
  domain: string;
};

type AuditResult = {
  audit: Audit;
  project: Project;
  pages: AuditPage[];
  issues: Issue[];
};

type HistoryItem = {
  id: string;
  url: string;
  status: string;
  score: number | null;
  pagesCrawled: number | null;
  pagesWithErrors: number | null;
  pagesWithWarnings: number | null;
  pagesPassed: number | null;
  createdAt?: string | null;
  completedAt?: string | null;
};

type DashboardClientProps = {
  user: User;
  subscription: SubscriptionState;
};

/* =========================================================
   HELPERS
========================================================= */

function scoreColorClass(score: number | null) {
  if (score === null) return "";
  if (score >= 90) return "score-excellent";
  if (score >= 75) return "score-good";
  if (score >= 60) return "score-warning";
  return "score-poor";
}

function scoreLabel(score: number | null) {
  if (score === null) return "Not scored";
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Needs improvement";
  return "Poor";
}

function severityBadgeClass(severity: string) {
  switch (severity.toLowerCase()) {
    case "critical":
    case "error":
      return "stripe-badge stripe-badge-danger";
    case "warning":
      return "stripe-badge stripe-badge-warning";
    case "notice":
      return "stripe-badge stripe-badge-info";
    default:
      return "stripe-badge stripe-badge-neutral";
  }
}

function formatDate(date?: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/* =========================================================
   COMPONENT
========================================================= */

export default function DashboardClient({
  user,
  subscription,
}: DashboardClientProps) {
  const [result, setResult] = useState<AuditResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [openError, setOpenError] = useState("");
  const [filter, setFilter] = useState("all");

  // Local override: if AuditForm hits a subscription gate mid-session
  // (e.g. another tab burned the last audit), swap to the upgrade card
  // without a full page reload.
  const [upgradeBlocked, setUpgradeBlocked] = useState(false);

  const displayName = user.name?.trim() || user.email.split("@")[0];

  const canRunAudit = subscription.canRunAudit && !upgradeBlocked;

  /* ---------- Load history ---------- */

  async function loadHistory(projectId: string) {
    setLoadingHistory(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/audits`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load audit history.");
      }

      setHistory(data.audits || []);
      if (data.project) setProject(data.project);
    } catch (err) {
      console.error("Unable to load audit history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    if (!project?.id) {
      setHistory([]);
      return;
    }
    loadHistory(project.id);
  }, [project?.id]);

  /* ---------- Audit form callbacks ---------- */

  function handleAuditSuccess(raw: unknown) {
    const data = raw as AuditResult;

    setResult({
      audit: data.audit,
      project: data.project,
      issues: data.issues || [],
      pages: (data.pages || []).map((page) => ({
        ...page,
        issues: page.issues || [],
      })),
    });

    setProject(data.project || null);
    setFilter("all");
    setOpenError("");
    setUpgradeBlocked(false);
  }

  function handleAuditError(code: AuditErrorCode) {
    if (
      code === "NO_SUBSCRIPTION" ||
      code === "AUDIT_LIMIT_REACHED" ||
      code === "PROJECT_LIMIT_REACHED"
    ) {
      setUpgradeBlocked(true);
    }
  }

  /* ---------- Open previous audit ---------- */

  async function openAudit(auditId: string) {
    setSelectedAudit(auditId);
    setLoadingAudit(true);
    setOpenError("");

    try {
      const response = await fetch(`/api/audits/${auditId}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load audit.");
      }

      setResult({
        audit: data.audit,
        project: data.project,
        issues: data.issues || [],
        pages: (data.pages || []).map((page: AuditPage) => ({
          ...page,
          issues: page.issues || [],
        })),
      });

      setProject(data.project || null);
    } catch (err) {
      setOpenError(
        err instanceof Error ? err.message : "Unable to load audit."
      );
    } finally {
      setLoadingAudit(false);
      setSelectedAudit(null);
    }
  }

  /* ---------- Derived ---------- */

  const issues = result?.issues || [];

  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    issues.forEach((issue) => {
      const category = issue.category || "Other";
      stats[category] = (stats[category] || 0) + 1;
    });
    return stats;
  }, [issues]);

  const filteredIssues = useMemo(() => {
    if (filter === "all") return issues;
    return issues.filter((i) => i.severity.toLowerCase() === filter);
  }, [issues, filter]);

  function startNewAudit() {
    setResult(null);
    setOpenError("");
    setFilter("all");
  }

  /* ---------- Welcome subtitle ---------- */

  const welcomeSubtitle = !subscription.hasSubscription
    ? "Subscribe to start running SEO audits."
    : subscription.auditsRemaining > 0
      ? `You have ${subscription.auditsRemaining} audit${
          subscription.auditsRemaining === 1 ? "" : "s"
        } remaining this period.`
      : "You've used all your audits for this period.";

  return (
    <div className="flex flex-col gap-6">
      {/* =====================================================
          2FA NUDGE BANNER
      ====================================================== */}
      {!user.twoFactorEnabledAt && <TwoFactorBanner />}

      {/* =====================================================
          FORM / UPGRADE GATE (no result yet)
      ====================================================== */}
      {!result && (
        <>
          <div>
            <div className="eyebrow mb-1">Dashboard</div>
            <h1 className="page-title">Welcome back, {displayName}</h1>
            <p className="page-subtitle">{welcomeSubtitle}</p>
          </div>

          {canRunAudit ? (
            <section className="stripe-panel">
              <div className="px-6 py-6">
                <AuditForm
                  onSuccess={handleAuditSuccess}
                  onError={handleAuditError}
                />
              </div>
            </section>
          ) : (
            <UpgradeGate
              hasSubscription={subscription.hasSubscription}
              planName={subscription.planName}
              auditsUsed={subscription.auditsUsed}
              auditLimit={subscription.auditLimit}
            />
          )}
        </>
      )}

      {/* =====================================================
          AUDIT RESULT
      ====================================================== */}
      {result && (
        <>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="eyebrow mb-1">SEO audit report</div>
              <h1 className="page-title break-all">
                {result.project.domain}
              </h1>
              <p className="page-subtitle">
                Completed {formatDate(result.audit.completedAt)}
              </p>
            </div>

            <button
              type="button"
              onClick={startNewAudit}
              className="btn-stripe btn-stripe-secondary self-start"
            >
              New audit
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="metric-card">
              <div className="metric-label">SEO score</div>
              <div
                className={`metric-value ${scoreColorClass(
                  result.audit.score
                )}`}
              >
                {result.audit.score ?? "—"}
              </div>
              <div className="metric-description">
                {scoreLabel(result.audit.score)}
              </div>
            </div>

            <StatCard
              title="Pages crawled"
              value={result.audit.pagesCrawled ?? 0}
              description="Pages analyzed"
            />

            <StatCard
              title="Issues"
              value={issues.length}
              description="Problems detected"
            />

            <StatCard
              title="Passed"
              value={result.audit.pagesPassed ?? 0}
              description="Pages without issues"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="stripe-panel">
              <div className="px-6 py-6">
                <h2 className="section-title">Issue summary</h2>
                <p className="section-description">
                  Issues grouped by severity.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  {(
                    ["critical", "error", "warning", "notice"] as const
                  ).map((severity) => {
                    const count = issues.filter(
                      (i) => i.severity.toLowerCase() === severity
                    ).length;

                    return (
                      <div
                        key={severity}
                        className="rounded-lg p-4"
                        style={{ background: "var(--border-light)" }}
                      >
                        <div className="metric-label capitalize">
                          {severity}
                        </div>
                        <div
                          className="mt-1 text-2xl font-bold"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {count}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="stripe-panel">
              <div className="px-6 py-6">
                <h2 className="section-title">Issue categories</h2>
                <p className="section-description">
                  Issues grouped by SEO area.
                </p>

                <div className="mt-5 flex flex-col gap-3">
                  {Object.entries(categoryStats).length === 0 ? (
                    <p
                      className="text-sm"
                      style={{ color: "var(--success)" }}
                    >
                      No issues detected.
                    </p>
                  ) : (
                    Object.entries(categoryStats).map(
                      ([category, count]) => (
                        <div
                          key={category}
                          className="flex items-center justify-between"
                        >
                          <span
                            className="text-sm capitalize"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {category}
                          </span>
                          <span className="stripe-badge stripe-badge-neutral">
                            {count}
                          </span>
                        </div>
                      )
                    )
                  )}
                </div>
              </div>
            </section>
          </div>

          <section className="stripe-panel overflow-hidden">
            <header
              className="border-b px-6 py-5"
              style={{ borderColor: "var(--border)" }}
            >
              <h2 className="section-title">Crawled pages</h2>
              <p className="section-description">
                SEO health of each discovered page.
              </p>
            </header>

            <div
              className="stripe-table-wrapper"
              style={{ border: 0, borderRadius: 0 }}
            >
              <table className="stripe-table">
                <thead>
                  <tr>
                    <th>URL</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Issues</th>
                  </tr>
                </thead>

                <tbody>
                  {result.pages.map((page) => (
                    <tr key={page.id}>
                      <td>
                        <div className="url-text" title={page.url}>
                          {page.url}
                        </div>
                        {page.title && (
                          <div
                            className="mt-1 text-xs"
                            style={{ color: "var(--text-subtle)" }}
                          >
                            {page.title}
                          </div>
                        )}
                      </td>

                      <td>
                        <span className="stripe-badge stripe-badge-neutral">
                          {page.statusCode ?? "—"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`font-bold ${scoreColorClass(
                            page.score
                          )}`}
                        >
                          {page.score ?? "—"}
                        </span>
                      </td>

                      <td>
                        <span className="stripe-badge stripe-badge-neutral">
                          {page.issues?.length || 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="stripe-panel overflow-hidden">
            <header
              className="flex flex-col gap-4 border-b px-6 py-5 md:flex-row md:items-center md:justify-between"
              style={{ borderColor: "var(--border)" }}
            >
              <div>
                <h2 className="section-title">SEO issues</h2>
                <p className="section-description">
                  Problems found during this audit.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {["all", "critical", "error", "warning", "notice"].map(
                  (severity) => {
                    const active = filter === severity;
                    return (
                      <button
                        key={severity}
                        type="button"
                        onClick={() => setFilter(severity)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition"
                        style={{
                          background: active
                            ? "var(--primary)"
                            : "var(--border-light)",
                          color: active
                            ? "#fff"
                            : "var(--text-secondary)",
                        }}
                      >
                        {severity}
                      </button>
                    );
                  }
                )}
              </div>
            </header>

            {filteredIssues.length === 0 ? (
              <div className="p-10 text-center">
                <p
                  className="text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  No issues found for this filter.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 p-6">
                {filteredIssues.map((issue, index) => (
                  <article
                    key={issue.id || `${issue.title}-${index}`}
                    className="issue-card"
                  >
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={severityBadgeClass(issue.severity)}
                      >
                        {issue.severity}
                      </span>
                      <span className="stripe-badge stripe-badge-neutral capitalize">
                        {issue.category}
                      </span>
                    </div>

                    <h3
                      className="mt-3 text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {issue.title}
                    </h3>

                    {issue.url && (
                      <div className="url-text mt-1" title={issue.url}>
                        {issue.url}
                      </div>
                    )}

                    {issue.description && (
                      <p
                        className="mt-3 text-sm leading-relaxed"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {issue.description}
                      </p>
                    )}

                    {issue.recommendation && (
                      <div
                        className="mt-4 rounded-lg p-4"
                        style={{ background: "var(--border-light)" }}
                      >
                        <div className="eyebrow mb-1">Recommendation</div>
                        <p
                          className="m-0 text-sm leading-relaxed"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {issue.recommendation}
                        </p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* =====================================================
          PROJECT / HISTORY
      ====================================================== */}
      {!result && project && (
        <>
          <div>
            <div className="eyebrow mb-1">Project</div>
            <h1 className="page-title">{project.domain}</h1>
          </div>

          {openError && (
            <div className="stripe-alert stripe-alert-danger" role="alert">
              <div>{openError}</div>
            </div>
          )}

          <section className="stripe-panel overflow-hidden">
            <header
              className="border-b px-6 py-5"
              style={{ borderColor: "var(--border)" }}
            >
              <h2 className="section-title">Audit history</h2>
              <p className="section-description">
                Previous SEO audits for this website.
              </p>
            </header>

            {loadingHistory ? (
              <div className="flex items-center gap-3 p-8">
                <div className="spinner-stripe" />
                <span
                  className="text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  Loading audit history...
                </span>
              </div>
            ) : history.length === 0 ? (
              <div
                className="empty-state"
                style={{ border: 0, borderRadius: 0 }}
              >
                <div className="empty-state-title">No previous audits</div>
                <p className="empty-state-description">
                  Run your first audit to start building history.
                </p>
              </div>
            ) : (
              <div
                className="divide-y"
                style={{ borderColor: "var(--border-light)" }}
              >
                {history.map((audit) => (
                  <div
                    key={audit.id}
                    className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <div
                        className="truncate text-sm font-medium"
                        style={{ color: "var(--text-primary)" }}
                        title={audit.url}
                      >
                        {audit.url}
                      </div>
                      <div
                        className="mt-1 text-xs"
                        style={{ color: "var(--text-subtle)" }}
                      >
                        {formatDate(audit.createdAt)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-6">
                      <div>
                        <div className="metric-label">Score</div>
                        <div
                          className={`text-lg font-bold ${scoreColorClass(
                            audit.score
                          )}`}
                        >
                          {audit.score ?? "—"}
                        </div>
                      </div>

                      <div>
                        <div className="metric-label">Pages</div>
                        <div
                          className="text-sm font-semibold"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {audit.pagesCrawled ?? 0}
                        </div>
                      </div>

                      <div>
                        <div className="metric-label">Affected</div>
                        <div
                          className="text-sm font-semibold"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {(audit.pagesWithErrors ?? 0) +
                            (audit.pagesWithWarnings ?? 0)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openAudit(audit.id)}
                        disabled={
                          loadingAudit && selectedAudit === audit.id
                        }
                        className="btn-stripe btn-stripe-secondary"
                      >
                        {loadingAudit && selectedAudit === audit.id
                          ? "Loading..."
                          : "View report"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* =====================================================
          EMPTY DASHBOARD
      ====================================================== */}
      {!result && !project && (
        <>
          <div className="text-center">
            <h1 className="page-title">Understand your website SEO</h1>
            <p className="page-subtitle">
              Crawl your website, discover SEO problems, and monitor
              your progress over time.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FeatureCard
              title="Technical SEO"
              description="Check HTTPS, canonical URLs, robots directives, structured data and more."
            />
            <FeatureCard
              title="On-Page SEO"
              description="Analyze titles, meta descriptions, headings, images, links and content."
            />
            <FeatureCard
              title="Audit History"
              description="Keep track of your SEO scores and compare audits over time."
            />
          </div>
        </>
      )}
    </div>
  );
}

/* =========================================================
   SUB-COMPONENTS
========================================================= */

function TwoFactorBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [checked, setChecked] = useState(false);

  /*
   * Remember dismissal for the session only. We deliberately
   * use sessionStorage, not localStorage, so the banner
   * reappears on the next visit — 2FA is a security nudge,
   * not a one-time notification.
   */
  useEffect(() => {
    if (typeof window === "undefined") {
      setChecked(true);
      return;
    }

    if (sessionStorage.getItem("hide-2fa-banner") === "1") {
      setDismissed(true);
    }

    setChecked(true);
  }, []);

  function handleDismiss() {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("hide-2fa-banner", "1");
    }
    setDismissed(true);
  }

  /*
   * Avoid a flash of the banner on first paint before
   * sessionStorage has been read. `checked` flips to true
   * after the effect runs.
   */
  if (!checked || dismissed) return null;

  return (
    <div
      className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
      style={{
        borderColor: "var(--border)",
        background: "var(--primary-light)",
      }}
      role="region"
      aria-label="Two-factor authentication recommendation"
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{
            background: "var(--surface)",
            color: "var(--primary)",
          }}
          aria-hidden="true"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </span>

        <div>
          <div
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Protect your account with two-factor authentication
          </div>
          <p
            className="mt-0.5 text-xs leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            Add an extra layer of security. It takes less than a
            minute — use an authenticator app or your email.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/dashboard/settings"
          className="btn-stripe btn-stripe-primary"
        >
          Enable 2FA
        </Link>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="rounded-lg p-2 transition"
          style={{ color: "var(--text-muted)" }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: number;
  description: string;
}) {
  return (
    <div className="metric-card">
      <div className="metric-label">{title}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-description">{description}</div>
    </div>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="stripe-panel">
      <div className="p-6">
        <div
          className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg"
          style={{
            background: "var(--primary)",
            color: "#fff",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h3 className="section-title">{title}</h3>
        <p className="section-description">{description}</p>
      </div>
    </div>
  );
}

function UpgradeGate({
  hasSubscription,
  planName,
  auditsUsed,
  auditLimit,
}: {
  hasSubscription: boolean;
  planName: string | null;
  auditsUsed: number;
  auditLimit: number;
}) {
  const isQuotaExhausted = hasSubscription;

  return (
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
            <path d="M12 2 15.09 8.26 22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </div>

        <h2 className="section-title mb-2">
          {isQuotaExhausted
            ? "You've used all your audits"
            : "Upgrade to run audits"}
        </h2>

        <p
          className="mb-6 max-w-md text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          {isQuotaExhausted ? (
            <>
              You've used {auditsUsed} of {auditLimit} audits on the{" "}
              {planName ?? "current"} plan this period. Upgrade for more
              audits, or wait until your next billing cycle.
            </>
          ) : (
            <>
              Subscribe to a plan to start crawling websites, uncover
              SEO issues, and track your scores over time.
            </>
          )}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="/dashboard/subscription"
            className="btn-stripe btn-stripe-primary"
          >
            {isQuotaExhausted ? "Upgrade plan" : "View plans"}
          </a>

          <a
            href="/dashboard/subscription"
            className="btn-stripe btn-stripe-secondary"
          >
            Compare plans
          </a>
        </div>
      </div>
    </section>
  );
}