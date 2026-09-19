"use client";

import SEOScore from "@/app/components/ui/seo-score";
import { useTypewriter } from "@/app/lib/hooks/use-motion";

const issues = [
  { label: "Missing meta descriptions", tone: "warning" as const },
  { label: "Multiple H1 headings", tone: "warning" as const },
  { label: "Broken internal links", tone: "danger" as const },
];

export default function DashboardPreview() {
  const url = useTypewriter("app.seoaudit.com/dashboard", {
    speed: 55,
    startDelay: 800,
  });

  return (
    <div className="lp-scale-in lp-sheen-wrap overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />

        <div className="ml-4 flex flex-1 items-center gap-2 rounded-md bg-white px-3 py-1.5 text-xs text-slate-400">
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
          <span>
            {url}
            <span className="lp-caret ml-0.5 inline-block">|</span>
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-3">
        <div className="flex justify-center">
          <SEOScore score={92} size="lg" />
        </div>

        <div className="md:col-span-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricTile label="Pages" value="24" />
            <MetricTile label="Critical" value="2" tone="danger" />
            <MetricTile label="Warnings" value="8" tone="warning" />
            <MetricTile label="Passed" value="37" tone="success" />
          </div>

          <div className="mt-6 space-y-3">
            {issues.map((issue, i) => (
              <div
                key={issue.label}
                className="lp-fade-up flex items-center justify-between rounded-lg border border-slate-200 p-3 transition-colors duration-300 hover:border-slate-300 hover:bg-slate-50"
                style={{ animationDelay: `${300 + i * 120}ms` }}
              >
                <span className="text-sm text-slate-700">
                  {issue.label}
                </span>
                <span
                  className={`stripe-badge ${
                    issue.tone === "danger"
                      ? "stripe-badge-danger"
                      : "stripe-badge-warning"
                  }`}
                >
                  {issue.tone === "danger" ? "Critical" : "Warning"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "danger" | "warning" | "success";
}) {
  const bg =
    tone === "danger"
      ? "bg-red-50"
      : tone === "warning"
        ? "bg-amber-50"
        : tone === "success"
          ? "bg-emerald-50"
          : "bg-slate-50";

  const text =
    tone === "danger"
      ? "text-red-700"
      : tone === "warning"
        ? "text-amber-700"
        : tone === "success"
          ? "text-emerald-700"
          : "text-slate-700";

  const labelColor =
    tone === "danger"
      ? "text-red-600"
      : tone === "warning"
        ? "text-amber-600"
        : tone === "success"
          ? "text-emerald-600"
          : "text-slate-500";

  return (
    <div
      className={`${bg} lp-lift rounded-xl p-4`}
    >
      <p className={`text-xs ${labelColor}`}>{label}</p>
      <p className={`mt-1 text-2xl font-bold ${text}`}>{value}</p>
    </div>
  );
}