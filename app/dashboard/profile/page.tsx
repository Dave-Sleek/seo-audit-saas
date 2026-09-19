import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const displayName =
    user.name?.trim() ||
    user.email.split("@")[0];

  const initial = displayName
    .charAt(0)
    .toUpperCase();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">
            Account
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Profile
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Manage your personal account information.
          </p>
        </div>

        {/* Profile card */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xl font-bold text-white">
                {initial}
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {displayName}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {user.email}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Name */}
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Full name
                </label>

                <input
                  id="name"
                  type="text"
                  value={displayName}
                  readOnly
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none"
                />

                <p className="mt-2 text-xs text-slate-500">
                  Your account name.
                </p>
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Email address
                </label>

                <input
                  id="email"
                  type="email"
                  value={user.email}
                  readOnly
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none"
                />

                <p className="mt-2 text-xs text-slate-500">
                  Your login email address.
                </p>
              </div>

              {/* Role */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Account type
                </label>

                <div className="flex h-[46px] items-center rounded-xl border border-slate-200 bg-slate-50 px-4">
                  <span className="inline-flex items-center gap-2 text-sm font-medium capitalize text-slate-700">
                    <i className="bi bi-person-circle text-slate-500" />
                    {user.role || "user"}
                  </span>
                </div>
              </div>

              {/* Verification */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Email verification
                </label>

                <div className="flex h-[46px] items-center rounded-xl border border-slate-200 bg-slate-50 px-4">
                  {user.emailVerifiedAt ? (
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                      <i className="bi bi-patch-check-fill" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-amber-700">
                      <i className="bi bi-exclamation-circle-fill" />
                      Not verified
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Future profile editing */}
            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm">
                  <i className="bi bi-info-circle" />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Profile changes
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Profile editing will be available here. Email
                    changes will require verification to keep your
                    account secure.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <i className="bi bi-shield-lock" />
                </span>

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Account security
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Keep your account credentials secure.
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/forgot-password"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <i className="bi bi-key" />
              Reset password
            </Link>
          </div>
        </section>

        {/* Quick links */}
        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link
            href="/dashboard/projects"
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <i className="bi bi-folder2-open" />
              </div>

              <i className="bi bi-arrow-up-right text-slate-400 transition group-hover:text-slate-700" />
            </div>

            <h3 className="mt-4 font-bold text-slate-900">
              Your projects
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              View and manage your SEO projects.
            </p>
          </Link>

          <Link
            href="/dashboard/subscription"
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <i className="bi bi-credit-card" />
              </div>

              <i className="bi bi-arrow-up-right text-slate-400 transition group-hover:text-slate-700" />
            </div>

            <h3 className="mt-4 font-bold text-slate-900">
              Subscription
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              View your plan and usage.
            </p>
          </Link>
        </section>
      </div>
    </main>
  );
}