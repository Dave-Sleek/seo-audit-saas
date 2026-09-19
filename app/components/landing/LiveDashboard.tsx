"use client";

import { useEffect, useState } from "react";
import { useInView, useTypewriter } from "@/app/lib/hooks/use-motion";

/* =========================================================
   TYPES
========================================================= */

type Page = {
  url: string;
  status: number;
  score: number;
};

type Issue = {
  label: string;
  severity: "critical" | "warning" | "passed";
};

/* =========================================================
   DATA
========================================================= */

const SAMPLE_PAGES: Page[] = [
  { url: "/", status: 200, score: 94 },
  { url: "/pricing", status: 200, score: 88 },
  { url: "/blog/seo-guide", status: 200, score: 76 },
  { url: "/about", status: 301, score: 71 },
  { url: "/contact", status: 200, score: 92 },
  { url: "/old-page", status: 404, score: 34 },
];

const SAMPLE_ISSUES: Issue[] = [
  { label: "Missing meta descriptions", severity: "warning" },
  { label: "Multiple H1 headings", severity: "warning" },
  { label: "Broken internal links", severity: "critical" },
  { label: "Images without alt text", severity: "warning" },
  { label: "Missing canonical URLs", severity: "critical" },
];

/* =========================================================
   COMPONENT
========================================================= */

export default function LiveDashboard() {
  const { ref, inView } = useInView<HTMLDivElement>({
    threshold: 0.2,
    rootMargin: "0px",
  });

  const typed = useTypewriter("https://naranio.com", {
    speed: 60,
    startDelay: 300,
    enabled: inView,
  });

  const [crawlProgress, setCrawlProgress] = useState(0);
  const [issueProgress, setIssueProgress] = useState(0);
  const [score, setScore] = useState(0);
  const [crawlDone, setCrawlDone] = useState(false);

  /* ---------- Drive the animation once in view ---------- */
  useEffect(() => {
    if (!inView) return;

    // Wait for the typewriter to finish.
    const startDelay = 300 + "https://naranio.com".length * 60 + 400;

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Reveal pages one by one.
    SAMPLE_PAGES.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          setCrawlProgress(i + 1);
        }, startDelay + i * 260)
      );
    });

    // After pages, mark crawl done + start score counter.
    const afterCrawl = startDelay + SAMPLE_PAGES.length * 260 + 300;
    timers.push(
      setTimeout(() => {
        setCrawlDone(true);

        // Score count-up.
        const duration = 1400;
        const start = performance.now();
        const target = 87;

        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          setScore(Math.round(target * eased));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, afterCrawl)
    );

    // Issues revealed after score starts.
    SAMPLE_ISSUES.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          setIssueProgress(i + 1);
        }, afterCrawl + 800 + i * 180)
      );
    });

    return () => timers.forEach(clearTimeout);
  }, [inView]);

  return (
    <div
      ref={ref}
      className="lp-scale-in overflow-hidden rounded-2xl border bg-white"
      style={{
        borderColor: "var(--border)",
        boxShadow:
          "0 30px 60px -30px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.03)",
      }}
    >
      {/* ---------- Browser chrome ---------- */}
      <div
        className="flex items-center gap-2 border-b px-4 py-3"
        style={{
          background: "var(--border-light)",
          borderColor: "var(--border)",
        }}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />

        <div
          className="ml-3 flex flex-1 items-center gap-2 rounded-md bg-white px-3 py-1.5 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="truncate">
            {typed}
            <span className="lp-caret ml-0.5 inline-block">|</span>
          </span>
        </div>

        {/* Live badge */}
        <div
          className="ml-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: crawlDone
              ? "var(--success-light)"
              : "var(--primary-light)",
            color: crawlDone ? "var(--success)" : "var(--primary)",
          }}
        >
          <span
            className="lp-pulse-dot h-1.5 w-1.5 rounded-full"
            style={{
              background: crawlDone ? "var(--success)" : "var(--primary)",
            }}
          />
          {crawlDone ? "Complete" : "Crawling"}
        </div>
      </div>

      {/* ---------- Body ---------- */}
      <div className="grid gap-6 p-6">
        {/* ---------- Top row: score + counters ---------- */}
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Score ring */}
          <div className="flex flex-col items-center justify-center">
            <div
              className="score-ring"
              style={{ ["--score" as string]: score }}
            >
              <div className="score-ring-inner">
                <div className="score-ring-value">{score}</div>
                <div className="score-ring-label">of 100</div>
              </div>
            </div>
            <div
              className="mt-3 text-xs font-semibold"
              style={{
                color:
                  score >= 75
                    ? "var(--success)"
                    : score >= 60
                      ? "var(--warning)"
                      : "var(--text-muted)",
              }}
            >
              {score >= 90
                ? "Excellent"
                : score >= 75
                  ? "Good"
                  : score >= 60
                    ? "Needs work"
                    : "Analyzing..."}
            </div>
          </div>

          {/* Counters */}
          <div className="grid grid-cols-2 gap-3 sm:col-span-2">
            <DashboardTile
              label="Pages crawled"
              value={crawlProgress}
              total={SAMPLE_PAGES.length}
              tone="neutral"
            />
            <DashboardTile
              label="Issues"
              value={issueProgress}
              total={SAMPLE_ISSUES.length}
              tone="warning"
            />
            <DashboardTile
              label="Critical"
              value={SAMPLE_ISSUES.slice(0, issueProgress).filter(
                (i) => i.severity === "critical"
              ).length}
              tone="danger"
            />
            <DashboardTile
              label="Passed"
              value={crawlDone ? 14 : Math.max(0, crawlProgress * 3)}
              tone="success"
            />
          </div>
        </div>

        {/* ---------- Pages list ---------- */}
        <div
          className="rounded-xl border"
          style={{ borderColor: "var(--border)" }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-2.5"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              Crawled pages
            </div>
            <div
              className="text-[11px] font-medium tabular-nums"
              style={{ color: "var(--text-subtle)" }}
            >
              {crawlProgress} / {SAMPLE_PAGES.length}
            </div>
          </div>

          <ul className="divide-y" style={{ borderColor: "var(--border-light)" }}>
            {SAMPLE_PAGES.map((page, i) => (
              <li
                key={page.url}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs transition-all duration-500"
                style={{
                  opacity: i < crawlProgress ? 1 : 0.18,
                  transform:
                    i < crawlProgress ? "translateX(0)" : "translateX(-6px)",
                }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background:
                        page.status === 200
                          ? "var(--success-light)"
                          : page.status >= 300 && page.status < 400
                            ? "var(--info-light)"
                            : "var(--danger-light)",
                      color:
                        page.status === 200
                          ? "var(--success)"
                          : page.status >= 300 && page.status < 400
                            ? "var(--info)"
                            : "var(--danger)",
                    }}
                  >
                    <svg
                      width="8"
                      height="8"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {page.status === 200 ? (
                        <polyline points="20 6 9 17 4 12" />
                      ) : (
                        <line x1="5" y1="12" x2="19" y2="12" />
                      )}
                    </svg>
                  </span>

                  <span
                    className="truncate font-mono"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {page.url}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className="tabular-nums"
                    style={{ color: "var(--text-subtle)" }}
                  >
                    {page.status}
                  </span>
                  <span
                    className="w-6 text-right text-sm font-bold tabular-nums"
                    style={{
                      color:
                        page.score >= 90
                          ? "var(--success)"
                          : page.score >= 70
                            ? "var(--warning)"
                            : "var(--danger)",
                    }}
                  >
                    {i < crawlProgress ? page.score : "—"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* ---------- Issues list ---------- */}
        <div
          className="rounded-xl border"
          style={{ borderColor: "var(--border)" }}
        >
          <div
            className="border-b px-4 py-2.5"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              Top issues
            </div>
          </div>

          <ul className="divide-y" style={{ borderColor: "var(--border-light)" }}>
            {SAMPLE_ISSUES.map((issue, i) => (
              <li
                key={issue.label}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs transition-all duration-500"
                style={{
                  opacity: i < issueProgress ? 1 : 0.15,
                  transform:
                    i < issueProgress ? "translateX(0)" : "translateX(6px)",
                }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`stripe-badge ${
                      issue.severity === "critical"
                        ? "stripe-badge-danger"
                        : "stripe-badge-warning"
                    }`}
                  >
                    {issue.severity}
                  </span>
                  <span
                    className="truncate"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {issue.label}
                  </span>
                </div>

                <div
                  className="h-1.5 w-16 overflow-hidden rounded-full"
                  style={{ background: "var(--border-light)" }}
                >
                  <div
                    className="lp-fill-bar h-full rounded-full"
                    style={{
                      width: i < issueProgress ? "100%" : "0%",
                      background:
                        issue.severity === "critical"
                          ? "var(--danger)"
                          : "var(--warning)",
                      transitionDelay: `${i * 100}ms`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   TILE
========================================================= */

function DashboardTile({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total?: number;
  tone: "neutral" | "danger" | "warning" | "success";
}) {
  const color =
    tone === "danger"
      ? "var(--danger)"
      : tone === "warning"
        ? "var(--warning)"
        : tone === "success"
          ? "var(--success)"
          : "var(--text-primary)";

  const bg =
    tone === "danger"
      ? "var(--danger-light)"
      : tone === "warning"
        ? "var(--warning-light)"
        : tone === "success"
          ? "var(--success-light)"
          : "var(--border-light)";

  return (
    <div className="rounded-xl p-3" style={{ background: bg }}>
      <div className="metric-label">{label}</div>
      <div
        className="mt-1 text-2xl font-bold tabular-nums"
        style={{ color }}
      >
        {value}
        {total !== undefined && (
          <span
            className="ml-1 text-sm font-medium"
            style={{ color: "var(--text-subtle)" }}
          >
            / {total}
          </span>
        )}
      </div>
    </div>
  );
}