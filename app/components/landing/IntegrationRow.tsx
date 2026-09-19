"use client";

const integrations = [
  { name: "Google Search Console", initials: "GSC" },
  { name: "Google Analytics", initials: "GA" },
  { name: "Ahrefs", initials: "Ah" },
  { name: "Semrush", initials: "Sr" },
  { name: "PageSpeed Insights", initials: "PSI" },
  { name: "Screaming Frog", initials: "SF" },
];

export default function IntegrationRow() {
  return (
    <section className="border-y py-10" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p
          className="mb-6 text-center text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-subtle)" }}
        >
          Built to work with the tools you already use
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {integrations.map((it) => (
            <div
              key={it.name}
              className="lp-lift flex items-center gap-2 rounded-xl border px-4 py-2.5"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
              }}
              title={it.name}
            >
              <div
                className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold"
                style={{
                  background: "var(--primary-light)",
                  color: "var(--primary)",
                }}
              >
                {it.initials}
              </div>
              <span
                className="hidden text-sm font-medium sm:block"
                style={{ color: "var(--text-secondary)" }}
              >
                {it.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}