import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { db } from "@/app/db";
import { audits, projects } from "@/app/db/schema";
import { getCurrentUser } from "@/app/lib/auth";

/* =========================================================
   HELPERS
========================================================= */

function scoreClass(score: number | null) {
  if (score === null) {
    return "text-slate-400";
  }

  if (score >= 90) {
    return "text-emerald-600";
  }

  if (score >= 75) {
    return "text-indigo-600";
  }

  if (score >= 60) {
    return "text-amber-600";
  }

  return "text-rose-600";
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "running":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";

    case "queued":
      return "border-slate-200 bg-slate-50 text-slate-600";

    case "failed":
      return "border-rose-200 bg-rose-50 text-rose-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function formatDate(value: string | Date | null) {
  if (!value) {
    return "—";
  }

  const date =
    typeof value === "string"
      ? new Date(value)
      : value;

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getScoreLabel(score: number | null) {
  if (score === null) {
    return "Not scored";
  }

  if (score >= 90) {
    return "Excellent";
  }

  if (score >= 75) {
    return "Good";
  }

  if (score >= 60) {
    return "Needs work";
  }

  return "Poor";
}

/* =========================================================
   PAGE
========================================================= */

export default async function AuditsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const rows = await db
    .select({
      audit: audits,
      project: {
        id: projects.id,
        name: projects.name,
        domain: projects.domain,
      },
    })
    .from(audits)
    .innerJoin(
      projects,
      eq(audits.projectId, projects.id)
    )
    .where(eq(projects.userId, user.id))
    .orderBy(desc(audits.createdAt))
    .limit(200);

  const completedAudits = rows.filter(
    ({ audit }) => audit.status === "completed"
  ).length;

  const runningAudits = rows.filter(
    ({ audit }) =>
      audit.status === "running" ||
      audit.status === "queued"
  ).length;

  const failedAudits = rows.filter(
    ({ audit }) => audit.status === "failed"
  ).length;

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* =====================================================
            HEADER
        ===================================================== */}
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <Link
                href="/dashboard"
                className="transition hover:text-slate-900"
              >
                Dashboard
              </Link>

              <span className="text-slate-300">
                /
              </span>

              <span className="text-slate-700">
                Audits
              </span>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Audits
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Review the SEO audits you've run across your projects.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="btn-stripe btn-stripe-primary"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>

            New audit
          </Link>
        </div>

        {/* =====================================================
            SUMMARY CARDS
        ===================================================== */}
        {rows.length > 0 && (
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Total audits
              </p>

              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {rows.length}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Completed
              </p>

              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {completedAudits}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                In progress
              </p>

              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {runningAudits}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Failed
              </p>

              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {failedAudits}
              </p>
            </div>
          </div>
        )}

        {/* =====================================================
            EMPTY STATE
        ===================================================== */}
        {rows.length === 0 ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="flex flex-col items-center px-6 py-20 text-center">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                <svg
                  width="21"
                  height="21"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-slate-500"
                >
                  <circle cx="11" cy="11" r="7.5" />
                  <path d="m20 20-3.7-3.7" />
                </svg>
              </div>

              <h2 className="text-base font-semibold text-slate-950">
                No audits yet
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Run your first website audit to analyze your
                technical SEO, on-page SEO, structured data,
                accessibility, and more.
              </p>

              <Link
                href="/dashboard"
                className="mt-6 inline-flex h-10 btn-stripe btn-stripe-primary"
              >
                Run your first audit
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">

            {/* =================================================
                TABLE HEADER
            ================================================= */}
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">
                    Audit history
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-500">
                    Your most recent website audits.
                  </p>
                </div>

                <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  Showing {rows.length}
                  {rows.length === 200 ? "+" : ""} audits
                </span>
              </div>
            </div>

            {/* =================================================
                DESKTOP TABLE
            ================================================= */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-left">
                    <th className="whitespace-nowrap px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Project
                    </th>

                    <th className="whitespace-nowrap px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      URL
                    </th>

                    <th className="whitespace-nowrap px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                      Score
                    </th>

                    <th className="whitespace-nowrap px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                      Pages
                    </th>

                    <th className="whitespace-nowrap px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                      Errors
                    </th>

                    <th className="whitespace-nowrap px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="whitespace-nowrap px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Date
                    </th>

                    <th className="px-6 py-3" />
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {rows.map(({ audit, project }) => (
                    <tr
                      key={audit.id}
                      className="group transition hover:bg-slate-50/70"
                    >
                      {/* PROJECT */}
                      <td className="px-6 py-4">
                        <Link
                          href={`/dashboard/project/${project.id}`}
                          className="block"
                        >
                          <p className="font-medium text-slate-900 group-hover:text-slate-700">
                            {project.name}
                          </p>

                          <p className="mt-0.5 max-w-[180px] truncate text-xs text-slate-500">
                            {project.domain}
                          </p>
                        </Link>
                      </td>

                      {/* URL */}
                      <td className="px-6 py-4">
                        <div
                          className="max-w-[260px] truncate text-slate-600"
                          title={audit.url}
                        >
                          {audit.url}
                        </div>
                      </td>

                      {/* SCORE */}
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex flex-col items-end">
                          <span
                            className={`text-base font-semibold tabular-nums ${scoreClass(
                              audit.score
                            )}`}
                          >
                            {audit.score ?? "—"}
                          </span>

                          {audit.score !== null && (
                            <span className="text-[11px] text-slate-400">
                              {getScoreLabel(audit.score)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* PAGES */}
                      <td className="px-6 py-4 text-right tabular-nums text-slate-700">
                        {audit.pagesCrawled ?? 0}
                      </td>

                      {/* ERRORS */}
                      <td className="px-6 py-4 text-right tabular-nums">
                        {(audit.pagesWithErrors ?? 0) > 0 ? (
                          <span className="font-medium text-rose-600">
                            {audit.pagesWithErrors}
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            0
                          </span>
                        )}
                      </td>

                      {/* STATUS */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusBadgeClass(
                            audit.status
                          )}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              audit.status === "completed"
                                ? "bg-emerald-500"
                                : audit.status === "running"
                                ? "bg-indigo-500"
                                : audit.status === "failed"
                                ? "bg-rose-500"
                                : "bg-slate-400"
                            }`}
                          />

                          {audit.status}
                        </span>
                      </td>

                      {/* DATE */}
                      <td className="whitespace-nowrap px-6 py-4 text-slate-500">
                        {formatDate(audit.createdAt)}
                      </td>

                      {/* ACTION */}
                      <td className="px-6 py-4 text-right">
                        {audit.status === "completed" ? (
                          <Link
                            href={`/dashboard/audits/${audit.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                          >
                            View report
                            <span aria-hidden="true">
                              →
                            </span>
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {audit.status === "failed"
                              ? "Failed"
                              : "In progress"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* =================================================
                MOBILE CARDS
            ================================================= */}
            <div className="divide-y divide-slate-100 md:hidden">
              {rows.map(({ audit, project }) => (
                <div
                  key={audit.id}
                  className="p-5"
                >
                  {/* TOP */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/project/${project.id}`}
                        className="text-sm font-semibold text-slate-900"
                      >
                        {project.name}
                      </Link>

                      <p className="mt-1 truncate text-xs text-slate-500">
                        {audit.url}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium capitalize ${statusBadgeClass(
                        audit.status
                      )}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          audit.status === "completed"
                            ? "bg-emerald-500"
                            : audit.status === "running"
                            ? "bg-indigo-500"
                            : audit.status === "failed"
                            ? "bg-rose-500"
                            : "bg-slate-400"
                        }`}
                      />

                      {audit.status}
                    </span>
                  </div>

                  {/* METRICS */}
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        Score
                      </p>

                      <p
                        className={`mt-1 text-lg font-semibold ${scoreClass(
                          audit.score
                        )}`}
                      >
                        {audit.score ?? "—"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        Pages
                      </p>

                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {audit.pagesCrawled ?? 0}
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        Errors
                      </p>

                      <p
                        className={`mt-1 text-lg font-semibold ${
                          (audit.pagesWithErrors ?? 0) > 0
                            ? "text-rose-600"
                            : "text-slate-900"
                        }`}
                      >
                        {audit.pagesWithErrors ?? 0}
                      </p>
                    </div>
                  </div>

                  {/* FOOTER */}
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <span className="text-xs text-slate-400">
                      {formatDate(audit.createdAt)}
                    </span>

                    {audit.status === "completed" ? (
                      <Link
                        href={`/dashboard/audits/${audit.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        View report
                        <span aria-hidden="true">
                          →
                        </span>
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">
                        {audit.status === "failed"
                          ? "Audit failed"
                          : "Audit in progress"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}