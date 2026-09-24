import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import { users } from "@/app/db/schema";
import ResendVerificationButton from "./resend-verification-button";
import SignOutButton from "./sign-out-button";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  missing: "The verification link is missing a token.",
  invalid: "This verification link is invalid.",
  used: "This verification link has already been used.",
  expired:
    "This verification link has expired. Request a new one below.",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const sessionUser = await getCurrentUser();

  if (!sessionUser) {
    redirect("/login");
  }

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1);

  if (!row) {
    redirect("/login");
  }

  /* Already verified — no need to stay here. */
  if (row.emailVerifiedAt) {
    redirect("/dashboard");
  }

  const errorMessage = error ? ERROR_MESSAGES[error] ?? null : null;

  const maskedEmail = row.email.replace(
    /^(.{1,2})(.*)(@.*)$/,
    (_, a, b, c) => `${a}${"•".repeat(b.length)}${c}`
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <div className="flex flex-col items-center text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m2 7 10 6 10-6" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-slate-900">
              Verify your email
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              We sent a verification link to{" "}
              <strong className="text-slate-900">
                {maskedEmail}
              </strong>
              . Click the link in the email to activate your
              account.
            </p>
          </div>

          {errorMessage && (
            <div
              className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          <div className="mt-8 flex flex-col items-center gap-4">
            <ResendVerificationButton />

            <p className="text-xs text-slate-500">
              The link expires after 24 hours. If you don&apos;t
              see the email, check your spam folder.
            </p>
          </div>

          <div className="mt-8 border-t border-slate-100 pt-6 text-center">
            <p className="text-xs text-slate-500">
              Wrong email address?{" "}
              <SignOutButton />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}