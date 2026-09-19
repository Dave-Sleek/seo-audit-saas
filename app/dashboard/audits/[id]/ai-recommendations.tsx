"use client";

import { useState } from "react";

/* =========================================================
   TYPES
========================================================= */

type Recommendation = {
  title: string;
  priority: "high" | "medium" | "low";
  category: string;
  problem: string;
  whyItMatters: string;
  recommendation: string;
  actionSteps: string[];
  affectedPages: string[];
};

type AIRecommendations = {
  summary: string;
  recommendations: Recommendation[];
  quickWins: string[];
  technicalNotes: string[];
};

type Props = {
  auditId: string;
  initialRecommendations?: AIRecommendations | null;
};

/* =========================================================
   HELPERS
========================================================= */

function priorityBadgeClass(priority: Recommendation["priority"]) {
  switch (priority) {
    case "high":
      return "stripe-badge stripe-badge-danger";
    case "medium":
      return "stripe-badge stripe-badge-warning";
    default:
      return "stripe-badge stripe-badge-success";
  }
}

function priorityDotClass(priority: Recommendation["priority"]) {
  switch (priority) {
    case "high":
      return "var(--danger)";
    case "medium":
      return "var(--warning)";
    default:
      return "var(--success)";
  }
}

/* =========================================================
   COMPONENT
========================================================= */

export default function AIRecommendations({
  auditId,
  initialRecommendations = null,
}: Props) {
  const [data, setData] = useState<AIRecommendations | null>(
    initialRecommendations
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateRecommendations = async (regenerate = false) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/audits/${auditId}/ai-recommendations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regenerate }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to generate AI recommendations."
        );
      }

      setData(result.recommendations);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to generate AI recommendations."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="ai-panel overflow-hidden">
      {/* =====================================================
          HEADER
      ====================================================== */}
      <header
        className="border-b px-6 py-5"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div
              className="flex shrink-0 items-center justify-center rounded-lg"
              style={{
                width: 40,
                height: 40,
                background: "var(--primary)",
                color: "#fff",
              }}
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
                <path d="M12 3v18M5.5 8.5l13 7M18.5 8.5l-13 7" />
              </svg>
            </div>

            <div>
              <h2 className="section-title">AI SEO recommendations</h2>
              <p className="section-description">
                Turn audit findings into an actionable improvement plan.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            {!data ? (
              <button
                type="button"
                className="btn-stripe btn-stripe-primary"
                onClick={() => generateRecommendations(false)}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-stripe" aria-hidden="true" />
                    Analyzing...
                  </>
                ) : (
                  <>
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
                      <path d="M12 3v18M5.5 8.5l13 7M18.5 8.5l-13 7" />
                    </svg>
                    Generate recommendations
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                className="btn-stripe btn-stripe-secondary"
                onClick={() => generateRecommendations(true)}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-stripe" aria-hidden="true" />
                    Regenerating...
                  </>
                ) : (
                  <>
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
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    Regenerate
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* =====================================================
          BODY
      ====================================================== */}
      <div className="px-6 py-6">
        {/* ---------- ERROR ---------- */}
        {error && (
          <div className="stripe-alert stripe-alert-danger mb-4" role="alert">
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
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <div className="font-semibold">
                Unable to generate recommendations
              </div>
              <div className="mt-0.5">{error}</div>
            </div>
          </div>
        )}

        {/* ---------- EMPTY ---------- */}
        {!data && !loading && !error && (
          <div className="empty-state">
            <div className="empty-state-icon">
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
                <path d="M12 3v18M5.5 8.5l13 7M18.5 8.5l-13 7" />
              </svg>
            </div>

            <div className="empty-state-title">
              Turn your audit into an action plan
            </div>

            <p className="empty-state-description">
              AI will analyze the SEO findings already detected by Visilytix
              and prioritize useful fixes for your website.
            </p>
          </div>
        )}

        {/* ---------- CONTENT ---------- */}
        {data && (
          <div className="flex flex-col gap-8">
            {/* ---------- SUMMARY ---------- */}
            <div className="ai-summary">
              <div className="eyebrow mb-2">AI summary</div>
              <p className="m-0 leading-relaxed">{data.summary}</p>
            </div>

            {/* ---------- RECOMMENDATIONS ---------- */}
            {data.recommendations.length > 0 && (
              <section>
                <header className="mb-4">
                  <h3 className="section-title">Priority recommendations</h3>
                  <p className="section-description">
                    Recommended actions based on the findings in this audit.
                  </p>
                </header>

                <div className="flex flex-col gap-3">
                  {data.recommendations.map((rec, index) => (
                    <article key={`${rec.title}-${index}`} className="ai-recommendation">
                      {/* Title row */}
                      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex items-start gap-3">
                          <div
                            className="flex shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                            style={{
                              width: 32,
                              height: 32,
                              background: "var(--primary-light)",
                              color: "var(--primary)",
                            }}
                          >
                            {index + 1}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <h4
                              className="m-0 text-base font-semibold"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {rec.title}
                            </h4>

                            <span className={priorityBadgeClass(rec.priority)}>
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  background: priorityDotClass(rec.priority),
                                }}
                                aria-hidden="true"
                              />
                              {rec.priority}
                            </span>

                            <span className="stripe-badge stripe-badge-neutral">
                              {rec.category}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Problem + why it matters */}
                      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                        <div>
                          <div
                            className="eyebrow mb-2"
                            style={{ letterSpacing: "0.06em" }}
                          >
                            Problem
                          </div>
                          <p
                            className="m-0 text-sm leading-relaxed"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {rec.problem}
                          </p>
                        </div>

                        <div>
                          <div
                            className="eyebrow mb-2"
                            style={{ letterSpacing: "0.06em" }}
                          >
                            Why it matters
                          </div>
                          <p
                            className="m-0 text-sm leading-relaxed"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {rec.whyItMatters}
                          </p>
                        </div>
                      </div>

                      {/* Recommended fix */}
                      <div className="code-panel mt-5" style={{ fontFamily: "inherit", fontSize: 13 }}>
                        <div
                          className="eyebrow mb-2"
                          style={{ letterSpacing: "0.06em" }}
                        >
                          Recommended fix
                        </div>
                        <p
                          className="m-0 leading-relaxed"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {rec.recommendation}
                        </p>
                      </div>

                      {/* Action steps + affected pages */}
                      {(rec.actionSteps.length > 0 ||
                        rec.affectedPages.length > 0) && (
                        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
                          {rec.actionSteps.length > 0 && (
                            <div>
                              <div
                                className="eyebrow mb-3"
                                style={{ letterSpacing: "0.06em" }}
                              >
                                Action steps
                              </div>

                              <ol
                                className="m-0 list-decimal pl-5 text-sm leading-relaxed"
                                style={{ color: "var(--text-secondary)" }}
                              >
                                {rec.actionSteps.map((step, stepIndex) => (
                                  <li key={stepIndex} className="mb-2">
                                    {step}
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}

                          {rec.affectedPages.length > 0 && (
                            <div>
                              <div
                                className="eyebrow mb-3"
                                style={{ letterSpacing: "0.06em" }}
                              >
                                Affected pages
                              </div>

                              <div className="flex flex-col gap-2">
                                {rec.affectedPages.slice(0, 10).map((url, i) => (
                                  <div
                                    key={`${url}-${i}`}
                                    className="url-text"
                                    title={url}
                                  >
                                    {url}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* ---------- QUICK WINS ---------- */}
            {data.quickWins.length > 0 && (
              <section>
                <header className="mb-4">
                  <h3 className="section-title">Quick wins</h3>
                  <p className="section-description">
                    Smaller improvements you can address quickly.
                  </p>
                </header>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {data.quickWins.map((quickWin, index) => (
                    <div
                      key={index}
                      className="rounded-lg border p-4"
                      style={{
                        borderColor: "var(--border)",
                        background: "var(--surface)",
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            color: "var(--success)",
                            flexShrink: 0,
                            marginTop: 3,
                          }}
                        >
                          <circle cx="12" cy="12" r="10" />
                          <path d="m9 12 2 2 4-4" />
                        </svg>

                        <span
                          className="text-sm leading-relaxed"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {quickWin}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ---------- TECHNICAL NOTES ---------- */}
            {data.technicalNotes.length > 0 && (
              <section>
                <header className="mb-4">
                  <h3 className="section-title">Technical notes</h3>
                  <p className="section-description">
                    Additional implementation details identified by the AI
                    analysis.
                  </p>
                </header>

                <div className="code-panel" style={{ fontFamily: "inherit" }}>
                  <ul
                    className="m-0 list-disc pl-5 text-sm leading-relaxed"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {data.technicalNotes.map((note, index) => (
                      <li key={index} className="mb-2 last:mb-0">
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {/* ---------- FOOTNOTE ---------- */}
            <footer
              className="flex items-start gap-2 border-t pt-4"
              style={{ borderColor: "var(--border-light)" }}
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
                style={{
                  color: "var(--text-subtle)",
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <p
                className="m-0 text-xs leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                AI recommendations are based on the SEO findings detected by
                the audit engine. They do not directly affect your SEO score.
              </p>
            </footer>
          </div>
        )}
      </div>
    </section>
  );
}