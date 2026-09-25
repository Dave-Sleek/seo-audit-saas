// app/dashboard/settings/activity/page.tsx

import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import { auditLog } from "@/app/db/schema";
import { getEventDisplay } from "@/app/lib/audit-events";

export const dynamic = "force-dynamic";

/* =========================================================
   HELPERS
========================================================= */

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return formatDateTime(date);
}

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "critical") {
    return (
      <span className="stripe-badge stripe-badge-danger">
        Critical
      </span>
    );
  }

  if (severity === "warning") {
    return (
      <span className="stripe-badge stripe-badge-warning">
        Warning
      </span>
    );
  }

  return null;
}

/* =========================================================
   ICONS
========================================================= */

function EventIcon({ icon }: { icon: string }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (icon === "login") {
    return (
      <svg {...common}>
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <polyline points="10 17 15 12 10 7" />
        <line x1="15" y1="12" x2="3" y2="12" />
      </svg>
    );
  }

  if (icon === "warning") {
    return (
      <svg {...common}>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }

  if (icon === "alert") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );
  }

  if (icon === "shield") {
    return (
      <svg {...common}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default async function ActivityPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const events = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.userId, user.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(100);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <nav
            className="breadcrumbs mb-3"
            aria-label="Breadcrumb"
          >
            <Link href="/dashboard">Dashboard</Link>
            <span className="breadcrumb-separator">/</span>
            <Link href="/dashboard/settings">Settings</Link>
            <span className="breadcrumb-separator">/</span>
            <span className="text-slate-900">Activity</span>
          </nav>

          <div className="eyebrow mb-1">Security</div>
          <h1 className="page-title">Recent activity</h1>
          <p className="page-subtitle">
            A log of the important events on your account. If you
            see something you don&apos;t recognize, change your
            password and enable two-factor authentication.
          </p>
        </div>

        <Link
          href="/dashboard/settings"
          className="btn-stripe btn-stripe-secondary inline-flex items-center gap-2 self-start"
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
            aria-hidden="true"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>settings</span>
        </Link>
      </div>

      {/* Events */}
      <section className="stripe-panel overflow-hidden">
        {events.length === 0 ? (
          <div className="empty-state border-0 rounded-none">
            <div className="empty-state-icon">
              <EventIcon icon="check" />
            </div>
            <div className="empty-state-title">No activity yet</div>
            <p className="empty-state-description">
              Account activity will appear here as you use the
              app.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {events.map((event) => {
              const display = getEventDisplay(event.eventType);

              const isCritical = event.severity === "critical";
              const isWarning = event.severity === "warning";

              const iconBg = isCritical
                ? "bg-red-50 text-red-600"
                : isWarning
                  ? "bg-amber-50 text-amber-600"
                  : "bg-slate-100 text-slate-500";

              return (
                <div
                  key={event.id}
                  className="flex items-start gap-4 px-5 py-4 lg:px-6"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
                    aria-hidden="true"
                  >
                    <EventIcon icon={display.icon} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {display.label}
                      </span>
                      <SeverityBadge severity={event.severity} />
                    </div>

                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                      {display.description}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span title={formatDateTime(event.createdAt)}>
                        {formatRelative(event.createdAt)}
                      </span>

                      {event.ipAddress && (
                        <span className="font-mono">
                          {event.ipAddress}
                        </span>
                      )}

                      {event.userAgent && (
                        <span
                          className="max-w-[280px] truncate"
                          title={event.userAgent}
                        >
                          {event.userAgent}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {events.length === 100 && (
        <p className="text-center text-xs text-slate-400">
          Showing the 100 most recent events.
        </p>
      )}
    </div>
  );
}