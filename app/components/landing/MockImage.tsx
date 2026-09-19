"use client";

import { ReactNode } from "react";

type MockVariant =
  | "technical"
  | "onpage"
  | "crawl"
  | "schema"
  | "social"
  | "ai"
  | "hero"
  | "report"
  | "url-input"
  | "crawl-progress";

type Props = {
  variant: MockVariant;
  ratio?: "16/9" | "4/3" | "1/1" | "3/2";
  className?: string;
  label?: string;
};

/* =========================================================
   WRAPPER
========================================================= */

export default function MockImage({
  variant,
  ratio = "16/9",
  className = "",
  label,
}: Props) {
  const ratioMap: Record<string, string> = {
    "16/9": "56.25%",
    "4/3": "75%",
    "1/1": "100%",
    "3/2": "66.66%",
  };

  return (
    <div
      className={`lp-mock relative w-full overflow-hidden rounded-xl border ${className}`}
      style={{
        background: "#f8fafc",
        borderColor: "var(--border)",
        paddingBottom: ratioMap[ratio],
      }}
      role="img"
      aria-label={label ?? variant}
    >
      <div className="absolute inset-0 flex items-center justify-center p-3">
        {renderVariant(variant)}
      </div>
    </div>
  );
}

/* =========================================================
   VARIANTS
========================================================= */

function renderVariant(variant: MockVariant): ReactNode {
  switch (variant) {
    case "technical":
      return <TechnicalMock />;
    case "onpage":
      return <OnPageMock />;
    case "crawl":
      return <CrawlMock />;
    case "schema":
      return <SchemaMock />;
    case "social":
      return <SocialMock />;
    case "ai":
      return <AIMock />;
    case "hero":
      return <HeroMock />;
    case "report":
      return <ReportMock />;
    case "url-input":
      return <UrlInputMock />;
    case "crawl-progress":
      return <CrawlProgressMock />;
  }
}

/* =========================================================
   SHARED PIECES
========================================================= */

function Chrome({
  children,
  title = "audit.example.com",
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border bg-white"
      style={{ borderColor: "var(--border)" }}>
      <div
        className="flex shrink-0 items-center gap-1.5 border-b px-2.5 py-1.5"
        style={{ borderColor: "var(--border-light)", background: "#fafbfc" }}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#ff5f57]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#febc2e]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#28c840]" />
        <span
          className="ml-2 truncate text-[9px]"
          style={{ color: "var(--text-subtle)" }}
        >
          {title}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-2.5">{children}</div>
    </div>
  );
}

function Row({
  label,
  ok,
  tone = "ok",
}: {
  label: string;
  ok?: boolean;
  tone?: "ok" | "warn" | "err";
}) {
  const color =
    tone === "ok"
      ? "var(--success)"
      : tone === "warn"
        ? "var(--warning)"
        : "var(--danger)";

  const bg =
    tone === "ok"
      ? "var(--success-light)"
      : tone === "warn"
        ? "var(--warning-light)"
        : "var(--danger-light)";

  return (
    <div className="flex items-center gap-1.5 py-1">
      <span
        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full"
        style={{ background: bg, color }}
      >
        <svg
          width="6"
          height="6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {tone === "ok" ? (
            <polyline points="20 6 9 17 4 12" />
          ) : (
            <line x1="5" y1="12" x2="19" y2="12" />
          )}
        </svg>
      </span>
      <span
        className="truncate text-[10px]"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </span>
      {ok !== undefined && (
        <span
          className="ml-auto text-[9px] font-medium"
          style={{ color }}
        >
          {ok ? "Pass" : "Fix"}
        </span>
      )}
    </div>
  );
}

/* =========================================================
   TECHNICAL
========================================================= */

function TechnicalMock() {
  return (
    <Chrome title="technical-audit">
      <div className="flex flex-col">
        <Row label="HTTPS enabled" tone="ok" ok={true} />
        <Row label="Canonical URL" tone="ok" ok={true} />
        <Row label="Robots meta" tone="ok" ok={true} />
        <Row label="Missing viewport" tone="warn" ok={false} />
        <Row label="Broken sitemap" tone="err" ok={false} />
      </div>
    </Chrome>
  );
}

/* =========================================================
   ON-PAGE
========================================================= */

function OnPageMock() {
  return (
    <Chrome title="on-page/analysis">
      <div className="flex flex-col gap-2">
        <div>
          <div className="mb-0.5 text-[8px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-subtle)" }}>
            Title
          </div>
          <div className="rounded border px-2 py-1 text-[10px]"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            Best SEO Tools for 2026
          </div>
        </div>

        <div>
          <div className="mb-0.5 text-[8px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-subtle)" }}>
            Meta description
          </div>
          <div className="space-y-1 rounded border px-2 py-1"
            style={{ borderColor: "var(--border)" }}>
            <div className="h-1 w-full rounded-full" style={{ background: "var(--border-light)" }} />
            <div className="h-1 w-3/4 rounded-full" style={{ background: "var(--border-light)" }} />
          </div>
        </div>

        <div className="flex gap-1">
          <span className="rounded px-1.5 py-0.5 text-[8px] font-medium"
            style={{ background: "var(--success-light)", color: "var(--success)" }}>
            H1 ✓
          </span>
          <span className="rounded px-1.5 py-0.5 text-[8px] font-medium"
            style={{ background: "var(--warning-light)", color: "var(--warning)" }}>
            2 H2
          </span>
        </div>
      </div>
    </Chrome>
  );
}

/* =========================================================
   CRAWL
========================================================= */

function CrawlMock() {
  return (
    <Chrome title="site-graph">
      <svg viewBox="0 0 200 100" className="h-full w-full">
        <defs>
          <linearGradient id="mock-edge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.7" />
          </linearGradient>
        </defs>

        <line x1="100" y1="50" x2="40" y2="20" stroke="url(#mock-edge)" strokeWidth="1" />
        <line x1="100" y1="50" x2="40" y2="80" stroke="url(#mock-edge)" strokeWidth="1" />
        <line x1="100" y1="50" x2="160" y2="20" stroke="url(#mock-edge)" strokeWidth="1" />
        <line x1="100" y1="50" x2="160" y2="80" stroke="url(#mock-edge)" strokeWidth="1" />
        <line x1="40" y1="20" x2="20" y2="50" stroke="url(#mock-edge)" strokeWidth="1" />
        <line x1="160" y1="20" x2="180" y2="50" stroke="url(#mock-edge)" strokeWidth="1" />

        {/* Root */}
        <circle cx="100" cy="50" r="10" fill="var(--primary)" />
        <text x="100" y="53" textAnchor="middle" fill="#fff" fontSize="6" fontWeight="700">
          /
        </text>

        {/* Leaves */}
        <circle cx="40" cy="20" r="6" fill="var(--success)" />
        <circle cx="40" cy="80" r="6" fill="var(--success)" />
        <circle cx="160" cy="20" r="6" fill="var(--warning)" />
        <circle cx="160" cy="80" r="6" fill="var(--danger)" />
        <circle cx="20" cy="50" r="5" fill="var(--success)" />
        <circle cx="180" cy="50" r="5" fill="var(--success)" />
      </svg>
    </Chrome>
  );
}

/* =========================================================
   SCHEMA
========================================================= */

function SchemaMock() {
  return (
    <Chrome title="schema/validator">
      <div className="rounded bg-slate-900 p-2 font-mono text-[8px] leading-tight text-slate-300">
        <div>
          <span className="text-amber-400">"@context"</span>:{" "}
          <span className="text-emerald-400">"schema.org"</span>,
        </div>
        <div>
          <span className="text-amber-400">"@type"</span>:{" "}
          <span className="text-emerald-400">"Article"</span>,
        </div>
        <div>
          <span className="text-amber-400">"headline"</span>:{" "}
          <span className="text-emerald-400">"Best SEO tools"</span>,
        </div>
        <div>
          <span className="text-amber-400">"author"</span>: {"{"}
        </div>
        <div className="pl-3">
          <span className="text-amber-400">"@type"</span>:{" "}
          <span className="text-emerald-400">"Person"</span>
        </div>
        <div>{"}"}</div>
      </div>

      <div className="mt-1.5 flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="text-[9px]" style={{ color: "var(--text-secondary)" }}>
          Valid JSON-LD
        </span>
      </div>
    </Chrome>
  );
}

/* =========================================================
   SOCIAL
========================================================= */

function SocialMock() {
  return (
    <Chrome title="social/preview">
      <div className="overflow-hidden rounded border" style={{ borderColor: "var(--border)" }}>
        <div
          className="flex h-12 items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #f97316 0%, #fbbf24 100%)",
          }}
        >
          <span className="text-[10px] font-bold text-white">OG Image</span>
        </div>

        <div className="p-1.5">
          <div className="text-[9px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Best SEO tools for 2026
          </div>
          <div className="mt-0.5 text-[8px]" style={{ color: "var(--text-subtle)" }}>
            example.com
          </div>
        </div>
      </div>

      <div className="mt-1.5 flex gap-1">
        <span className="rounded px-1.5 py-0.5 text-[8px] font-medium"
          style={{ background: "var(--success-light)", color: "var(--success)" }}>
          OG ✓
        </span>
        <span className="rounded px-1.5 py-0.5 text-[8px] font-medium"
          style={{ background: "var(--success-light)", color: "var(--success)" }}>
          Twitter ✓
        </span>
      </div>
    </Chrome>
  );
}

/* =========================================================
   AI
========================================================= */

function AIMock() {
  return (
    <Chrome title="ai/recommendations">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-1.5">
          <div
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v18M5.5 8.5l13 7M18.5 8.5l-13 7" />
            </svg>
          </div>
          <div className="min-w-0 flex-1 rounded-lg px-2 py-1.5"
            style={{ background: "var(--primary-light)" }}>
            <div className="text-[9px] font-semibold" style={{ color: "#c2410c" }}>
              High priority
            </div>
            <div className="mt-0.5 text-[9px]" style={{ color: "var(--text-secondary)" }}>
              Fix 12 broken internal links
            </div>
          </div>
        </div>

        <div className="flex items-start gap-1.5">
          <div
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v18M5.5 8.5l13 7M18.5 8.5l-13 7" />
            </svg>
          </div>
          <div className="min-w-0 flex-1 rounded-lg px-2 py-1.5"
            style={{ background: "var(--warning-light)" }}>
            <div className="text-[9px] font-semibold" style={{ color: "#92400e" }}>
              Medium
            </div>
            <div className="mt-0.5 text-[9px]" style={{ color: "var(--text-secondary)" }}>
              Rewrite 8 meta descriptions
            </div>
          </div>
        </div>
      </div>
    </Chrome>
  );
}

/* =========================================================
   HERO
========================================================= */

function HeroMock() {
  return (
    <div
      className="flex h-full w-full overflow-hidden rounded-xl border"
      style={{
        borderColor: "rgba(255,255,255,0.08)",
        background: "#0f0a06",
      }}
    >
      {/* Sidebar */}
      <div
        className="hidden w-12 shrink-0 flex-col gap-2 p-2 sm:flex"
        style={{ background: "rgba(255,255,255,0.02)" }}
      >
        <div className="h-6 w-6 rounded" style={{ background: "var(--primary)" }} />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-5 w-5 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
        ))}
      </div>

      {/* Main */}
      <div className="flex-1 p-3">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="h-3 w-24 rounded" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="h-5 w-5 rounded-full" style={{ background: "var(--primary)" }} />
        </div>

        {/* Score + metrics */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg p-2" style={{ background: "rgba(249,115,22,0.12)" }}>
            <div className="text-[8px]" style={{ color: "#fb923c" }}>Score</div>
            <div className="text-lg font-bold text-white">87</div>
          </div>
          <div className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="text-[8px] text-slate-400">Pages</div>
            <div className="text-lg font-bold text-white">24</div>
          </div>
          <div className="rounded-lg p-2" style={{ background: "rgba(239,68,68,0.12)" }}>
            <div className="text-[8px]" style={{ color: "#f87171" }}>Issues</div>
            <div className="text-lg font-bold text-white">12</div>
          </div>
        </div>

        {/* Rows */}
        <div className="mt-3 space-y-1.5">
          {[
            { w: "85%", c: "var(--primary)" },
            { w: "60%", c: "var(--warning)" },
            { w: "40%", c: "var(--danger)" },
          ].map((bar, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full" style={{ width: bar.w, background: bar.c }} />
              </div>
              <div className="h-1.5 w-6 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   REPORT
========================================================= */

function ReportMock() {
  return (
    <Chrome title="report/overview">
      <div className="flex h-full gap-2">
        {/* Score ring */}
        <div className="flex flex-col items-center justify-center">
          <div
            className="relative flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background:
                "conic-gradient(var(--primary) 0deg 313deg, var(--border-light) 313deg 360deg)",
            }}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                87
              </span>
            </div>
          </div>
        </div>

        {/* Bars */}
        <div className="flex flex-1 flex-col justify-center gap-1.5">
          {[
            { label: "Technical", v: 92 },
            { label: "On-page", v: 84 },
            { label: "Content", v: 81 },
            { label: "Social", v: 94 },
          ].map((row) => (
            <div key={row.label}>
              <div className="flex justify-between text-[8px]"
                style={{ color: "var(--text-subtle)" }}>
                <span>{row.label}</span>
                <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>
                  {row.v}%
                </span>
              </div>
              <div className="mt-0.5 h-1 overflow-hidden rounded-full"
                style={{ background: "var(--border-light)" }}>
                <div className="h-full rounded-full"
                  style={{ width: `${row.v}%`, background: "var(--primary)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Chrome>
  );
}

/* =========================================================
   URL INPUT
========================================================= */

function UrlInputMock() {
  return (
    <Chrome title="step 1 — enter URL">
      <div className="flex h-full flex-col justify-center">
        <div className="flex items-center gap-1.5 rounded-lg border px-2 py-1.5"
          style={{ borderColor: "var(--border)" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span className="text-[10px] font-medium" style={{ color: "var(--text-primary)" }}>
            https://example.com
          </span>
          <span className="lp-caret ml-auto text-[10px] font-bold" style={{ color: "var(--primary)" }}>
            |
          </span>
        </div>

        <div
          className="mt-2 inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[9px] font-semibold text-white"
          style={{ background: "var(--primary)" }}
        >
          Analyze
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
      </div>
    </Chrome>
  );
}

/* =========================================================
   CRAWL PROGRESS
========================================================= */

function CrawlProgressMock() {
  return (
    <Chrome title="step 2 — crawling">
      <div className="flex flex-col gap-1.5">
        {[
          { url: "/", status: 200, done: true },
          { url: "/pricing", status: 200, done: true },
          { url: "/blog", status: 200, done: true },
          { url: "/about", status: 301, done: false },
          { url: "/contact", status: 200, done: false },
        ].map((p, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 transition-opacity"
            style={{ opacity: p.done ? 1 : 0.35 }}
          >
            <span
              className="flex h-3 w-3 items-center justify-center rounded-full"
              style={{
                background: p.status === 200 ? "var(--success-light)" : "var(--info-light)",
                color: p.status === 200 ? "var(--success)" : "var(--info)",
              }}
            >
              <svg width="5" height="5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                {p.status === 200 ? <polyline points="20 6 9 17 4 12" /> : <line x1="5" y1="12" x2="19" y2="12" />}
              </svg>
            </span>
            <span className="truncate font-mono text-[9px]" style={{ color: "var(--text-secondary)" }}>
              {p.url}
            </span>
            <span className="ml-auto text-[8px]" style={{ color: "var(--text-subtle)" }}>
              {p.status}
            </span>
          </div>
        ))}

        <div className="mt-1 h-1 overflow-hidden rounded-full" style={{ background: "var(--border-light)" }}>
          <div className="lp-fill-bar h-full rounded-full" style={{ width: "60%", background: "var(--primary)" }} />
        </div>
      </div>
    </Chrome>
  );
}