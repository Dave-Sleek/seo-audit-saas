"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SitewideClient from "./sitewide-client";
import AIRecommendations from "./ai-recommendations";

/* =========================================================
   TYPES
========================================================= */

type AIRecommendation = {
  title: string;
  priority: "high" | "medium" | "low";
  category: string;
  problem: string;
  whyItMatters: string;
  recommendation: string;
  actionSteps: string[];
  affectedPages: string[];
};

type AIRecommendationsData = {
  summary: string;
  recommendations: AIRecommendation[];
  quickWins: string[];
  technicalNotes: string[];
};

type AuditReport = {
  success: boolean;
  project: { id: string; name: string; domain: string };
  audit: {
    id: string;
    url: string;
    status: string;
    score: number | null;
    pagesCrawled: number | null;
    pagesWithErrors: number | null;
    pagesWithWarnings: number | null;
    pagesPassed: number | null;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string | null;
    aiRecommendations: AIRecommendationsData | null;
    aiGeneratedAt: string | null;
    aiModel: string | null;
  };
  summary: {
    score: number;
    pages: {
      total: number;
      passed: number;
      good: number;
      warnings: number;
      poor: number;
    };
    issues: {
      critical: number;
      errors: number;
      warnings: number;
      notices: number;
    };
    priorities: { high: number; medium: number; low: number };
    scoreChange: number | null;
  };
  categoryScores: Record<string, number>;
  priorityIssues: Array<{
    id: string;
    category: string;
    type: string;
    severity: string;
    title: string;
    description: string | null;
    recommendation: string | null;
  }>;
  pages: Array<{
    id: string;
    url: string;
    finalUrl: string | null;
    statusCode: number | null;
    title: string | null;
    pageScore: number | null;
    imagesWithoutAlt: number | null;
    responseTimeMs: number | null;
  }>;
  comparison: {
    previous: {
      id: string;
      score: number | null;
      pagesCrawled: number | null;
      pagesWithErrors: number | null;
      pagesWithWarnings: number | null;
      pagesPassed: number | null;
      createdAt: string | null;
    } | null;
    scoreChange: number | null;
  };
};

/* =========================================================
   HELPERS
========================================================= */

function scoreLabel(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Needs improvement";
  return "Poor";
}

function scoreTone(score: number | null) {
  if (score === null) return "neutral";
  if (score >= 90) return "success";
  if (score >= 75) return "info";
  if (score >= 60) return "warning";
  return "danger";
}

/** Maps a score to the `.score-*` color utility defined in globals.css */
function scoreColorClass(score: number) {
  if (score >= 90) return "score-excellent";
  if (score >= 75) return "score-good";
  if (score >= 60) return "score-warning";
  return "score-poor";
}

/** Maps a score to the `.progress-*` bar fill utility */
function progressClass(score: number) {
  if (score >= 90) return "progress-success";
  if (score >= 60) return "progress-warning";
  return "progress-danger";
}

function scoreBadgeClass(score: number | null) {
  return `stripe-badge stripe-badge-${scoreTone(score)}`;
}

function severityBadgeClass(severity: string) {
  switch (severity.toLowerCase()) {
    case "critical":
      return "stripe-badge stripe-badge-danger";
    case "error":
      return "stripe-badge stripe-badge-danger";
    case "warning":
      return "stripe-badge stripe-badge-warning";
    case "notice":
      return "stripe-badge stripe-badge-neutral";
    default:
      return "stripe-badge stripe-badge-neutral";
  }
}

function severityBorderClass(severity: string) {
  switch (severity.toLowerCase()) {
    case "critical":
      return "issue-card issue-critical";
    case "error":
      return "issue-card issue-error";
    case "warning":
      return "issue-card issue-warning";
    default:
      return "issue-card issue-notice";
  }
}

function statusBadgeClass(status: string) {
  switch (status.toLowerCase()) {
    case "completed":
    case "complete":
      return "stripe-badge stripe-badge-success";
    case "running":
    case "processing":
    case "queued":
      return "stripe-badge stripe-badge-info";
    case "failed":
    case "error":
      return "stripe-badge stripe-badge-danger";
    default:
      return "stripe-badge stripe-badge-neutral";
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/* =========================================================
   PAGE
========================================================= */

export default function AuditReportClient({
  auditId,
}: {
  auditId: string;
}) {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadReport() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`/api/audits/${auditId}/report`, {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load audit report.");
        }

        setReport(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load audit report."
        );
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, [auditId]);

  const categoryData = useMemo(() => {
    if (!report) return [];

    const labels: Record<string, string> = {
      technical: "Technical",
      "on-page": "On-page",
      crawlability: "Crawlability",
      content: "Content",
      links: "Links",
      images: "Images",
      social: "Social",
      "structured-data": "Structured data",
    };

    return Object.entries(report.categoryScores).map(([key, score]) => ({
      key,
      label: labels[key] || key,
      score: Number(score) || 0,
    }));
  }, [report]);

  /* ---------- LOADING ---------- */
  if (loading) {
    return (
      <div className="stripe-panel" style={{ padding: 20 }}>
        <div className="flex items-center gap-3">
          <div className="spinner-stripe" role="status" />
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            Generating SEO report...
          </span>
        </div>
      </div>
    );
  }

  /* ---------- ERROR ---------- */
  if (error || !report) {
    return (
      <div className="flex flex-col gap-4">
        <div className="stripe-alert stripe-alert-danger" role="alert">
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
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <div className="font-semibold">Audit report unavailable</div>
            <div className="mt-0.5">
              {error || "Audit report unavailable."}
            </div>
          </div>
        </div>

        <Link
          href="/dashboard"
          className="btn-stripe btn-stripe-secondary self-start"
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
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to dashboard
        </Link>
      </div>
    );
  }

  const score = report.summary.score;
  const totalErrors =
    report.summary.issues.errors + report.summary.issues.critical;

  return (
    <div className="flex flex-col gap-6">
      {/* =====================================================
          HEADER
      ====================================================== */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <nav className="breadcrumbs mb-3" aria-label="Breadcrumb">
            <Link href="/dashboard">Dashboard</Link>
            <span className="breadcrumb-separator">/</span>
            <Link href={`/dashboard/projects/${report.project.id}`}>
              {report.project.name}
            </Link>
            <span className="breadcrumb-separator">/</span>
            <span>Audit</span>
          </nav>

          <div className="eyebrow mb-1">{report.project.domain}</div>

          <h1 className="page-title">SEO audit report</h1>

          <p
            className="page-subtitle break-all"
            title={report.audit.url}
          >
            {report.audit.url}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/projects/${report.project.id}`}
            className="btn-stripe btn-stripe-secondary"
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
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Audit history
          </Link>

          <Link href="/dashboard" className="btn-stripe btn-stripe-primary">
            Dashboard
          </Link>
        </div>
      </div>

      {/* =====================================================
          METADATA STRIP
      ====================================================== */}
      <div className="stripe-panel overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3">
          <div
            className="px-5 py-4 border-b md:border-b-0 md:border-r"
            style={{
              borderColor: "var(--border)",
            }}
          >
            <div className="metric-label mb-1">Audited URL</div>
            <div
              className="text-sm font-semibold break-all"
              style={{ color: "var(--text-primary)" }}
              title={report.audit.url}
            >
              {report.audit.url}
            </div>
          </div>

          <div
            className="px-5 py-4 border-b md:border-b-0 md:border-r"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="metric-label mb-1">Audit date</div>
            <div
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {formatDate(report.audit.createdAt)}
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="metric-label mb-2">Status</div>
            <span className={statusBadgeClass(report.audit.status)}>
              {report.audit.status}
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================
          SCORE + OVERVIEW
      ====================================================== */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Score card */}
        <div className="stripe-panel lg:col-span-1">
          <div className="p-6">
            <div className="metric-label mb-5">Overall SEO score</div>

            <div className="flex flex-col items-center">
              <div
                className="score-ring mb-4"
                style={{ ["--score" as string]: score }}
              >
                <div className="score-ring-inner">
                  <div className="score-ring-value">{score}</div>
                  <div className="score-ring-label">of 100</div>
                </div>
              </div>

              <div
                className={`text-base font-semibold ${scoreColorClass(score)}`}
              >
                {scoreLabel(score)}
              </div>
            </div>

            {report.summary.scoreChange !== null && (
              <div
                className="mt-6 flex items-center justify-between border-t pt-4"
                style={{ borderColor: "var(--border-light)" }}
              >
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Since previous audit
                </span>
                <span
                  className="text-sm font-bold"
                  style={{
                    color:
                      report.summary.scoreChange >= 0
                        ? "var(--success)"
                        : "var(--danger)",
                  }}
                >
                  {report.summary.scoreChange >= 0 ? "+" : ""}
                  {report.summary.scoreChange} pts
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Overview metrics */}
        <div className="stripe-panel lg:col-span-2">
          <div className="p-6">
            <div className="mb-5">
              <h2 className="section-title">Audit overview</h2>
              <p className="section-description">
                A snapshot of the pages and issues found during this audit.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div
                className="metric-card"
                style={{ boxShadow: "none" }}
              >
                <div className="metric-label">Pages</div>
                <div className="metric-value">{report.summary.pages.total}</div>
              </div>

              <div className="metric-card" style={{ boxShadow: "none" }}>
                <div
                  className="metric-label"
                  style={{ color: "var(--success)" }}
                >
                  Passed
                </div>
                <div
                  className="metric-value"
                  style={{ color: "var(--success)" }}
                >
                  {report.summary.pages.passed}
                </div>
              </div>

              <div className="metric-card" style={{ boxShadow: "none" }}>
                <div
                  className="metric-label"
                  style={{ color: "var(--warning)" }}
                >
                  Warnings
                </div>
                <div
                  className="metric-value"
                  style={{ color: "var(--warning)" }}
                >
                  {report.summary.pages.warnings}
                </div>
              </div>

              <div className="metric-card" style={{ boxShadow: "none" }}>
                <div
                  className="metric-label"
                  style={{ color: "var(--danger)" }}
                >
                  Errors
                </div>
                <div
                  className="metric-value"
                  style={{ color: "var(--danger)" }}
                >
                  {totalErrors}
                </div>
              </div>
            </div>

            <div
              className="mt-5 grid grid-cols-3 gap-3 border-t pt-5"
              style={{ borderColor: "var(--border-light)" }}
            >
              <div>
                <div
                  className="metric-label"
                  style={{ color: "var(--danger)" }}
                >
                  Critical
                </div>
                <div
                  className="mt-1 text-lg font-bold"
                  style={{ color: "var(--danger)" }}
                >
                  {report.summary.issues.critical}
                </div>
              </div>

              <div>
                <div
                  className="metric-label"
                  style={{ color: "var(--warning)" }}
                >
                  Medium
                </div>
                <div
                  className="mt-1 text-lg font-bold"
                  style={{ color: "var(--warning)" }}
                >
                  {report.summary.priorities.medium}
                </div>
              </div>

              <div>
                <div className="metric-label">Low</div>
                <div
                  className="mt-1 text-lg font-bold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {report.summary.priorities.low}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          CATEGORY PERFORMANCE
      ====================================================== */}
      <section className="stripe-panel">
        <div className="p-6">
          <div className="mb-5">
            <h2 className="section-title">Category performance</h2>
            <p className="section-description">
              See how your website performs across major SEO areas.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {categoryData.map((category) => (
              <div
                key={category.key}
                className="rounded-lg border p-4"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {category.label}
                  </span>
                  <span
                    className={`text-sm font-bold ${scoreColorClass(
                      category.score
                    )}`}
                  >
                    {category.score}
                  </span>
                </div>

                <div className="stripe-progress">
                  <div
                    className={`stripe-progress-bar ${progressClass(
                      category.score
                    )}`}
                    role="progressbar"
                    aria-valuenow={category.score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    style={{
                      width: `${Math.min(100, Math.max(0, category.score))}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          SITEWIDE
      ====================================================== */}
      <section>
        <div className="mb-4">
          <h2 className="section-title">Sitewide SEO intelligence</h2>
          <p className="section-description">
            Problems discovered by comparing the crawled pages against each
            other.
          </p>
        </div>

        <SitewideClient auditId={auditId} />
      </section>

      {/* =====================================================
          AI RECOMMENDATIONS
      ====================================================== */}
      <section>
        <AIRecommendations
          auditId={auditId}
          initialRecommendations={report.audit.aiRecommendations}
        />
      </section>

      {/* =====================================================
          PRIORITY ISSUES
      ====================================================== */}
      <section className="stripe-panel">
        <div className="p-6">
          <div className="mb-5">
            <h2 className="section-title">Priority issues</h2>
            <p className="section-description">
              Start with these to address the most important SEO problems.
            </p>
          </div>

          {report.priorityIssues.length === 0 ? (
            <div className="stripe-alert stripe-alert-success">
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
              >
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <div>
                <div className="font-semibold">
                  No major SEO issues detected
                </div>
                <div className="mt-0.5">
                  The audit engine did not identify any high-priority
                  problems.
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {report.priorityIssues.map((issue) => (
                <div
                  key={issue.id}
                  className={severityBorderClass(issue.severity)}
                >
                  <div className="flex items-start gap-3">
                    <span className={severityBadgeClass(issue.severity)}>
                      {issue.severity}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div
                        className="text-sm font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {issue.title}
                      </div>

                      {issue.description && (
                        <p
                          className="mt-1 text-sm"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {issue.description}
                        </p>
                      )}

                      {issue.recommendation && (
                        <div
                          className="mt-3 text-sm"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          <span
                            className="font-semibold"
                            style={{ color: "var(--text-primary)" }}
                          >
                            Recommendation:{" "}
                          </span>
                          {issue.recommendation}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* =====================================================
          CRAWLED PAGES
      ====================================================== */}
      <section className="stripe-panel overflow-hidden">
        <header
          className="border-b px-6 py-5"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="section-title">Crawled pages</h2>
          <p className="section-description">
            Page-level results collected during the audit.
          </p>
        </header>

        <div className="stripe-table-wrapper" style={{ border: 0, borderRadius: 0 }}>
          <table className="stripe-table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Status</th>
                <th>Score</th>
                <th>Response</th>
                <th>Images without alt</th>
              </tr>
            </thead>

            <tbody>
              {report.pages.map((page) => (
                <tr key={page.id}>
                  <td>
                    <div
                      className="url-text"
                      title={page.url}
                    >
                      {page.url}
                    </div>
                  </td>

                  <td>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {page.statusCode ?? "—"}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`text-sm font-bold ${scoreColorClass(
                        page.pageScore ?? 0
                      )}`}
                    >
                      {page.pageScore ?? "—"}
                    </span>
                  </td>

                  <td>
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {page.responseTimeMs
                        ? `${page.responseTimeMs} ms`
                        : "—"}
                    </span>
                  </td>

                  <td>
                    <span
                      className="text-sm font-semibold"
                      style={{
                        color:
                          (page.imagesWithoutAlt ?? 0) > 0
                            ? "var(--warning)"
                            : "var(--success)",
                      }}
                    >
                      {page.imagesWithoutAlt ?? 0}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* =====================================================
          COMPARISON
      ====================================================== */}
      <section className="stripe-panel">
        <div className="p-6">
          <div className="mb-5">
            <h2 className="section-title">Comparison with previous audit</h2>
            <p className="section-description">
              Track how the site's SEO performance changes between audits.
            </p>
          </div>

          {!report.comparison.previous ? (
            <div className="stripe-alert stripe-alert-info">
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
              >
                <line x1="3" y1="12" x2="21" y2="12" />
                <polyline points="8 7 3 12 8 17" />
                <polyline points="16 7 21 12 16 17" />
              </svg>
              <div>
                <div className="font-semibold">
                  First audit for this project
                </div>
                <div className="mt-0.5">
                  Future audits will be compared against this result.
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="metric-card">
                <div className="metric-label">Previous score</div>
                <div className="metric-value">
                  {report.comparison.previous.score ?? "—"}
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Current score</div>
                <div
                  className={`metric-value ${scoreColorClass(
                    report.summary.score
                  )}`}
                >
                  {report.summary.score}
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Change</div>
                <div
                  className="metric-value"
                  style={{
                    color:
                      (report.comparison.scoreChange ?? 0) >= 0
                        ? "var(--success)"
                        : "var(--danger)",
                  }}
                >
                  {(report.comparison.scoreChange ?? 0) >= 0 ? "+" : ""}
                  {report.comparison.scoreChange ?? 0}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}