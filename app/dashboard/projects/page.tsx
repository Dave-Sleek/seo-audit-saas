import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { db } from "@/app/db";
import { projects } from "@/app/db/schema";
import { getCurrentUser } from "@/app/lib/auth";

export default async function ProjectsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, user.id))
    .orderBy(desc(projects.createdAt));

  const activeProjects = rows.filter(
    (project) => project.isActive
  ).length;

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">

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

              <span className="text-slate-300">/</span>

              <span className="text-slate-700">
                Projects
              </span>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Projects
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage the websites you're tracking for SEO.
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
            SUMMARY
        ===================================================== */}
        {rows.length > 0 && (
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Total projects
              </p>

              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {rows.length}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Active projects
              </p>

              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {activeProjects}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:col-span-2 lg:col-span-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Status
              </p>

              <div className="mt-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />

                <span className="text-sm font-medium text-slate-700">
                  Monitoring enabled
                </span>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            CONTENT
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
                  <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />
                </svg>
              </div>

              <h2 className="text-base font-semibold text-slate-950">
                No projects yet
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Projects are created automatically when you run
                your first audit on a website. Your projects will
                appear here so you can manage their audit history.
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

            {/* TABLE HEADER */}
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">
                    Your projects
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-500">
                    Websites currently associated with your account.
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {rows.length}{" "}
                  {rows.length === 1 ? "project" : "projects"}
                </span>
              </div>
            </div>

            {/* DESKTOP TABLE */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-left">
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Project
                    </th>

                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Domain
                    </th>

                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Created
                    </th>

                    <th className="px-6 py-3" />
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {rows.map((project) => (
                    <tr
                      key={project.id}
                      className="group transition hover:bg-slate-50/70"
                    >
                      {/* PROJECT */}
                      <td className="px-6 py-4">
                        <Link
                          href={`/dashboard/projects/${project.id}`}
                          className="flex items-center gap-3"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                            {project.name
                              .charAt(0)
                              .toUpperCase()}
                          </span>

                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900 group-hover:text-slate-700">
                              {project.name}
                            </p>

                            {project.description && (
                              <p className="mt-0.5 max-w-[260px] truncate text-xs text-slate-500">
                                {project.description}
                              </p>
                            )}
                          </div>
                        </Link>
                      </td>

                      {/* DOMAIN */}
                      <td className="px-6 py-4">
                        <span className="text-slate-600">
                          {project.domain}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td className="px-6 py-4">
                        {project.isActive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* CREATED */}
                      <td className="whitespace-nowrap px-6 py-4 text-slate-500">
                        {project.createdAt.toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                      </td>

                      {/* ACTION */}
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/dashboard/projects/${project.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                        >
                          View project
                          <span aria-hidden="true">→</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE LIST */}
            <div className="divide-y divide-slate-100 md:hidden">
              {rows.map((project) => (
                <Link
                  key={project.id}
                  href={`/dashboard/projects/${project.id}`}
                  className="block p-5 transition hover:bg-slate-50"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                      {project.name
                        .charAt(0)
                        .toUpperCase()}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {project.name}
                          </p>

                          <p className="mt-1 truncate text-xs text-slate-500">
                            {project.domain}
                          </p>
                        </div>

                        <span className="text-slate-400">
                          →
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        {project.isActive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            Inactive
                          </span>
                        )}

                        <span className="text-xs text-slate-400">
                          {project.createdAt.toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}