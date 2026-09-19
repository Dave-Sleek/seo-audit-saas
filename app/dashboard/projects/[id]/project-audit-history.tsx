"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type HistoryItem = {
  id: string;
  url: string;
  status: string;
  score: number | null;
  scoreChange: number | null;
  pagesCrawled: number | null;
  pagesWithErrors: number | null;
  pagesWithWarnings: number | null;
  pagesPassed: number | null;
  createdAt: string | null;
  completedAt: string | null;
};

type HistoryResponse = {
  success: boolean;
  project: {
    id: string;
    name: string;
    domain: string;
  };
  history: HistoryItem[];
};

function scoreClass(score: number | null) {
  if (score === null) return "text-slate-500";
  if (score >= 90) return "text-emerald-600";
  if (score >= 75) return "text-indigo-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

function scoreBadgeClass(score: number | null) {
  if (score === null) {
    return "bg-slate-100 text-slate-600 border-slate-200";
  }

  if (score >= 90) {
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  }

  if (score >= 75) {
    return "bg-indigo-50 text-indigo-700 border-indigo-100";
  }

  if (score >= 60) {
    return "bg-amber-50 text-amber-700 border-amber-100";
  }

  return "bg-red-50 text-red-700 border-red-100";
}

function statusBadgeClass(status: string) {
  switch (status.toLowerCase()) {
    case "completed":
    case "complete":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";

    case "running":
    case "processing":
      return "bg-indigo-50 text-indigo-700 border-indigo-100";

    case "failed":
    case "error":
      return "bg-red-50 text-red-700 border-red-100";

    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function scoreLabel(score: number | null) {
  if (score === null) return "Not scored";
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Needs improvement";
  return "Poor";
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatChange(value: number | null) {
  if (value === null) return "—";

  return `${value >= 0 ? "+" : ""}${value}`;
}

function getChangeClass(value: number | null) {
  if (value === null) return "text-slate-400";

  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-red-600";

  return "text-slate-500";
}

export default function ProjectAuditHistory({
  projectId,
}: {
  projectId: string;
}) {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHistory() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/projects/${projectId}/audit-history`,
          {
            cache: "no-store",
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to load audit history."
          );
        }

        setData(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load audit history."
        );
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, [projectId]);

  /* =========================================================
     Loading
     ========================================================= */

  if (loading) {
    return (
      <div className="stripe-panel p-6">
        <div className="flex items-center gap-3">
          <div
            className="spinner-stripe"
            role="status"
            aria-label="Loading"
          />

          <span className="text-sm text-slate-600">
            Loading audit history...
          </span>
        </div>
      </div>
    );
  }

  /* =========================================================
     Error
     ========================================================= */

  if (error || !data) {
    return (
      <div className="stripe-alert stripe-alert-danger">
        <i className="bi bi-exclamation-circle text-base" />

        <div>
          <div className="font-semibold">
            Unable to load audit history
          </div>

          <div className="mt-1">
            {error || "Unable to load history."}
          </div>
        </div>
      </div>
    );
  }

  const latestAudit = data.history[0] ?? null;

  const totalAudits = data.history.length;

  const latestScore = latestAudit?.score ?? null;

  const latestPages = latestAudit?.pagesCrawled ?? 0;

  const latestStatus = latestAudit?.status ?? null;

  /* =========================================================
     Main
     ========================================================= */

  return (
    <div className="space-y-6">
      {/* =====================================================
          Header
          ===================================================== */}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          {/* Breadcrumbs */}

          <nav
            className="breadcrumbs mb-4"
            aria-label="Breadcrumb"
          >
            <Link href="/dashboard">Dashboard</Link>

            <span className="breadcrumb-separator">
              <i className="bi bi-chevron-right text-[10px]" />
            </span>

            <span>Project</span>

            <span className="breadcrumb-separator">
              <i className="bi bi-chevron-right text-[10px]" />
            </span>

            <span className="text-slate-900">
              Audit history
            </span>
          </nav>

          {/* Project identity */}

          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <i className="bi bi-globe2 text-sm" />
            </span>

            <span className="domain-text">
              {data.project.domain}
            </span>
          </div>

          <h2 className="page-title">Audit history</h2>

          <p className="page-subtitle max-w-2xl">
            Review previous SEO audits and track how{" "}
            <span className="font-medium text-slate-700">
              {data.project.name}
            </span>{" "}
            has changed over time.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="btn-stripe btn-stripe-secondary self-start lg:self-auto"
        >
          <i className="bi bi-arrow-left" />
          <span>Dashboard</span>
        </Link>
      </div>

      {/* =====================================================
          Summary Metrics
          ===================================================== */}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Total audits */}

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <span className="metric-label">
              Total audits
            </span>

            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
              <i className="bi bi-clock-history" />
            </span>
          </div>

          <div className="metric-value">
            {totalAudits}
          </div>

          <div className="metric-description">
            Audit runs recorded
          </div>
        </div>

        {/* Latest score */}

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <span className="metric-label">
              Latest score
            </span>

            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <i className="bi bi-speedometer2" />
            </span>
          </div>

          <div
            className={`metric-value ${scoreClass(
              latestScore
            )}`}
          >
            {latestScore ?? "—"}
          </div>

          <div className="metric-description">
            {scoreLabel(latestScore)}
          </div>
        </div>

        {/* Pages analyzed */}

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <span className="metric-label">
              Pages analyzed
            </span>

            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
              <i className="bi bi-file-earmark-text" />
            </span>
          </div>

          <div className="metric-value">
            {latestPages}
          </div>

          <div className="metric-description">
            From the latest audit
          </div>
        </div>

        {/* Latest status */}

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <span className="metric-label">
              Latest status
            </span>

            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
              <i className="bi bi-activity" />
            </span>
          </div>

          <div className="mt-3">
            {latestStatus ? (
              <span
                className={`stripe-badge border px-3 py-1.5 capitalize ${statusBadgeClass(
                  latestStatus
                )}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    latestStatus.toLowerCase() ===
                      "completed" ||
                    latestStatus.toLowerCase() ===
                      "complete"
                      ? "bg-emerald-500"
                      : latestStatus.toLowerCase() ===
                          "failed" ||
                        latestStatus.toLowerCase() ===
                          "error"
                      ? "bg-red-500"
                      : "bg-indigo-500"
                  }`}
                />

                {latestStatus}
              </span>
            ) : (
              <span className="text-sm text-slate-400">
                —
              </span>
            )}
          </div>

          <div className="metric-description">
            Most recent audit
          </div>
        </div>
      </div>

      {/* =====================================================
          Audit History Panel
          ===================================================== */}

      <section className="stripe-panel overflow-hidden">
        {/* Panel Header */}

        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <div>
            <div className="eyebrow mb-1">
              Audit activity
            </div>

            <h3 className="section-title">
              Previous audits
            </h3>

            <p className="section-description">
              Compare scores, page coverage, and issues
              across previous audit runs.
            </p>
          </div>

          {totalAudits > 0 && (
            <div className="stripe-badge stripe-badge-neutral self-start">
              {totalAudits}{" "}
              {totalAudits === 1 ? "audit" : "audits"}
            </div>
          )}
        </div>

        {/* Empty state */}

        {data.history.length === 0 ? (
          <div className="empty-state border-0 rounded-none">
            <div className="empty-state-icon">
              <i className="bi bi-search" />
            </div>

            <div className="empty-state-title">
              No audits yet
            </div>

            <p className="empty-state-description">
              Run your first audit to start building your
              SEO history and track improvements over time.
            </p>
          </div>
        ) : (
          /* =================================================
             Responsive Table
             ================================================= */

          <div className="overflow-x-auto">
            <table className="stripe-table min-w-[900px]">
              <thead>
                <tr>
                  <th className="pl-5 lg:pl-6">
                    Audit
                  </th>

                  <th>Score</th>

                  <th>Change</th>

                  <th>Pages</th>

                  <th>Issues</th>

                  <th>Status</th>

                  <th className="pr-5 text-right lg:pr-6">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {data.history.map((audit) => {
                  const issueCount =
                    (audit.pagesWithErrors ?? 0) +
                    (audit.pagesWithWarnings ?? 0);

                  return (
                    <tr key={audit.id}>
                      {/* Audit */}

                      <td className="pl-5 lg:pl-6">
                        <div className="flex min-w-[250px] items-start gap-3">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                            <i className="bi bi-file-earmark-bar-graph text-sm" />
                          </div>

                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900">
                              {formatDate(
                                audit.createdAt
                              )}
                            </div>

                            <div
                              className="url-text mt-1"
                              title={audit.url}
                            >
                              {audit.url}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Score */}

                      <td>
                        <div className="flex items-center gap-2">
                          <span
                            className={`stripe-badge border px-2.5 py-1 font-bold ${scoreBadgeClass(
                              audit.score
                            )}`}
                          >
                            {audit.score ?? "—"}
                          </span>
                        </div>
                      </td>

                      {/* Change */}

                      <td>
                        {audit.scoreChange === null ? (
                          <span className="text-slate-400">
                            —
                          </span>
                        ) : (
                          <div
                            className={`flex items-center gap-1.5 font-semibold ${getChangeClass(
                              audit.scoreChange
                            )}`}
                          >
                            <i
                              className={`bi ${
                                audit.scoreChange > 0
                                  ? "bi-arrow-up"
                                  : audit.scoreChange <
                                    0
                                  ? "bi-arrow-down"
                                  : "bi-dash"
                              }`}
                            />

                            {formatChange(
                              audit.scoreChange
                            )}
                          </div>
                        )}
                      </td>

                      {/* Pages */}

                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">
                            {audit.pagesCrawled ?? 0}
                          </span>

                          {audit.pagesPassed !== null &&
                            audit.pagesCrawled !==
                              null &&
                            audit.pagesCrawled > 0 && (
                              <span className="text-xs text-slate-400">
                                /
                                {audit.pagesPassed}
                                {" "}passed
                              </span>
                            )}
                        </div>
                      </td>

                      {/* Issues */}

                      <td>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-red-600">
                              {audit.pagesWithErrors ??
                                0}{" "}
                              errors
                            </span>

                            <span className="text-slate-300">
                              ·
                            </span>

                            <span className="font-semibold text-amber-600">
                              {audit.pagesWithWarnings ??
                                0}{" "}
                              warnings
                            </span>
                          </div>

                          <span className="text-xs text-slate-400">
                            {issueCount} total affected
                            pages
                          </span>
                        </div>
                      </td>

                      {/* Status */}

                      <td>
                        <span
                          className={`stripe-badge border capitalize ${statusBadgeClass(
                            audit.status
                          )}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              audit.status.toLowerCase() ===
                                "completed" ||
                              audit.status.toLowerCase() ===
                                "complete"
                                ? "bg-emerald-500"
                                : audit.status.toLowerCase() ===
                                      "failed" ||
                                    audit.status.toLowerCase() ===
                                      "error"
                                ? "bg-red-500"
                                : "bg-indigo-500"
                            }`}
                          />

                          {audit.status}
                        </span>
                      </td>

                      {/* Action */}

                      <td className="pr-5 text-right lg:pr-6">
                        <Link
                          href={`/dashboard/audits/${audit.id}`}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                        >
                          View report

                          <i className="bi bi-arrow-up-right text-[11px]" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* =====================================================
          Footer information
          ===================================================== */}

      {data.history.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {data.history.length}{" "}
            {data.history.length === 1
              ? "audit"
              : "audits"}{" "}
            for {data.project.domain}
          </span>

          {latestAudit?.createdAt && (
            <span>
              Latest audit:{" "}
              {formatDate(latestAudit.createdAt)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}