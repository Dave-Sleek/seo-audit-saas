"use client";

import { useEffect, useState } from "react";

/* =========================================================
   TYPES
========================================================= */

type SitewideData = {
  audit: {
    id: string;
    score: number | null;
    sitewideScore: number;
    pagesCrawled: number | null;
  };

  analysis: {
    score: number;
    pagesAnalyzed: number;

    duplicateTitles: number;
    duplicateMetaDescriptions: number;
    thinContentPages: number;
    orphanPages: number;
    brokenInternalLinks: number;
    canonicalConflicts: number;
    redirectChains: number;

    priorityIssues: Array<{
      type: string;
      severity: string;
      title: string;
      description: string;
      recommendation: string;
      affectedCount: number;
      affectedPages: string[];
    }>;
  };
};

/* =========================================================
   HELPERS
========================================================= */

function scoreColorClass(score: number) {
  if (score >= 90) return "score-excellent";
  if (score >= 75) return "score-good";
  if (score >= 60) return "score-warning";
  return "score-poor";
}

/**
 * Metrics are "good" when zero, "bad" when positive.
 * Neutral gray for zero so a clean audit doesn't glow green.
 */
function metricValueColor(value: number) {
  return value > 0 ? "var(--warning)" : "var(--success)";
}

function severityBadgeClass(severity: string) {
  switch (severity.toLowerCase()) {
    case "critical":
      return "stripe-badge stripe-badge-danger";
    case "error":
      return "stripe-badge stripe-badge-danger";
    case "warning":
      return "stripe-badge stripe-badge-warning";
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

/* =========================================================
   ICONS (inline SVG — no Bootstrap font dependency)
========================================================= */

const Icon = {
  Type: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  ),
  File: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  Network: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="3" />
      <circle cx="5" cy="19" r="3" />
      <circle cx="19" cy="19" r="3" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="12" x2="5" y2="16" />
      <line x1="12" y1="12" x2="19" y2="16" />
    </svg>
  ),
  Link: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  Split: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5" />
      <path d="M8 3H3v5" />
      <path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" />
      <path d="m15 9 6-6" />
    </svg>
  ),
  Cycle: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  ),
  AlertCircle: ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  CheckCircle: ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
};

/* =========================================================
   COMPONENT
========================================================= */

export default function SitewideClient({
  auditId,
}: {
  auditId: string;
}) {
  const [data, setData] = useState<SitewideData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/audits/${auditId}/sitewide`, {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Unable to load sitewide analysis.");
        }

        setData(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load sitewide analysis."
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [auditId]);

  /* ---------- LOADING ---------- */
  if (loading) {
    return (
      <div className="stripe-panel" style={{ padding: 20 }}>
        <div className="flex items-center gap-3">
          <div className="spinner-stripe" role="status" />
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            Analyzing sitewide SEO signals...
          </span>
        </div>
      </div>
    );
  }

  /* ---------- ERROR ---------- */
  if (error || !data) {
    return (
      <div className="stripe-alert stripe-alert-danger" role="alert">
        <Icon.AlertCircle />
        <div>
          <div className="font-semibold">Sitewide analysis unavailable</div>
          <div className="mt-0.5">
            {error || "Unable to load sitewide analysis."}
          </div>
        </div>
      </div>
    );
  }

  const { analysis } = data;

  const metrics = [
    { label: "Duplicate titles", value: analysis.duplicateTitles, Icon: Icon.Type },
    { label: "Duplicate meta", value: analysis.duplicateMetaDescriptions, Icon: Icon.File },
    { label: "Thin content", value: analysis.thinContentPages, Icon: Icon.File },
    { label: "Orphan pages", value: analysis.orphanPages, Icon: Icon.Network },
    { label: "Broken links", value: analysis.brokenInternalLinks, Icon: Icon.Link },
    { label: "Canonical conflicts", value: analysis.canonicalConflicts, Icon: Icon.Split },
    { label: "Redirect chains", value: analysis.redirectChains, Icon: Icon.Cycle },
  ];

  return (
    <section className="stripe-panel overflow-hidden">
      <div className="px-6 py-6">
        {/* =====================================================
            SCORE + METRICS GRID
        ====================================================== */}
        <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Sitewide score card */}
          <div className="lg:col-span-1">
            <div
              className="flex h-full flex-col rounded-lg border p-5"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="metric-label mb-4">Sitewide SEO score</div>

              <div className="flex flex-1 flex-col items-center justify-center">
                <div
                  className="score-ring mb-3"
                  style={{ ["--score" as string]: analysis.score }}
                >
                  <div className="score-ring-inner">
                    <div className="score-ring-value">{analysis.score}</div>
                    <div className="score-ring-label">of 100</div>
                  </div>
                </div>

                <div
                  className="text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  {analysis.pagesAnalyzed} pages analyzed
                </div>
              </div>

              <div
                className="mt-5 flex items-center justify-between border-t pt-4"
                style={{ borderColor: "var(--border-light)" }}
              >
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Pages crawled
                </span>
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {data.audit.pagesCrawled ?? 0}
                </span>
              </div>
            </div>
          </div>

          {/* Metric grid */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {metrics.map(({ label, value, Icon: MetricIcon }) => (
                <div key={label} className="metric-card">
                  <div
                    className="mb-2 flex items-center"
                    style={{ color: "var(--text-subtle)" }}
                    aria-hidden="true"
                  >
                    <MetricIcon />
                  </div>

                  <div className="metric-label mb-1">{label}</div>

                  <div
                    className="text-2xl font-bold tabular-nums"
                    style={{ color: metricValueColor(value) }}
                  >
                    {value}
                  </div>

                  <div
                    className="mt-1 text-xs"
                    style={{ color: "var(--text-subtle)" }}
                  >
                    {value === 0 ? "No issues found" : "Pages affected"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* =====================================================
            PRIORITIES
        ====================================================== */}
        <div
          className="border-t pt-6"
          style={{ borderColor: "var(--border)" }}
        >
          <header className="mb-5">
            <h2 className="section-title">Sitewide priorities</h2>
            <p className="section-description">
              Issues identified by comparing multiple pages across your
              website.
            </p>
          </header>

          {analysis.priorityIssues.length === 0 ? (
            <div className="stripe-alert stripe-alert-success" role="status">
              <Icon.CheckCircle />
              <div>
                <div className="font-semibold">
                  No significant sitewide problems
                </div>
                <div className="mt-0.5">
                  No major cross-page SEO problems were detected.
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {analysis.priorityIssues.map((issue, index) => (
                <div
                  key={`${issue.type}-${index}`}
                  className={severityBorderClass(issue.severity)}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className="flex shrink-0 items-center justify-center rounded-lg"
                        style={{
                          width: 32,
                          height: 32,
                          background: "var(--border-light)",
                          color: "var(--text-muted)",
                        }}
                        aria-hidden="true"
                      >
                        <Icon.AlertCircle size={14} />
                      </div>

                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <div
                            className="text-sm font-semibold"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {issue.title}
                          </div>

                          <span className={severityBadgeClass(issue.severity)}>
                            {issue.severity}
                          </span>
                        </div>

                        <p
                          className="m-0 text-sm leading-relaxed"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {issue.description}
                        </p>

                        <div
                          className="mt-3 text-sm leading-relaxed"
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
                      </div>
                    </div>

                    <div className="shrink-0">
                      <span className="stripe-badge stripe-badge-neutral">
                        {issue.affectedCount} affected
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}