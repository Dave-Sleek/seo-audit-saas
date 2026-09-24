"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type State =
  | { kind: "verifying" }
  | { kind: "success" }
  | { kind: "error"; message: string; code: string };

export default function VerifyEmailConfirmClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [state, setState] = useState<State>({ kind: "verifying" });

  /*
   * Only run the verification once, even under React strict
   * mode which double-invokes effects in dev.
   */
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (!token) {
      setState({
        kind: "error",
        code: "MISSING",
        message: "The verification link is missing a token.",
      });
      return;
    }

    async function verify() {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          setState({
            kind: "error",
            code: data?.code ?? "UNKNOWN",
            message:
              data?.error ?? "Unable to verify your email.",
          });
          return;
        }

        setState({ kind: "success" });

        /*
         * Auto-redirect after a short delay so the user
         * sees the success confirmation. router.refresh()
         * ensures the dashboard re-renders with the
         * now-verified session.
         */
        setTimeout(() => {
          router.push("/dashboard?verified=1");
          router.refresh();
        }, 1200);
      } catch {
        setState({
          kind: "error",
          code: "NETWORK",
          message: "Network error. Please try again.",
        });
      }
    }

    verify();
  }, [token, router]);

  /* =========================================================
     Render
  ========================================================= */

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          {state.kind === "verifying" && <VerifyingView />}
          {state.kind === "success" && <SuccessView />}
          {state.kind === "error" && (
            <ErrorView message={state.message} code={state.code} />
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Views
========================================================= */

function VerifyingView() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <div className="spinner-stripe" aria-hidden="true" />
      </div>

      <h1 className="text-2xl font-bold text-slate-900">
        Verifying your email
      </h1>

      <p className="mt-3 text-sm text-slate-600">
        Just a moment — we&apos;re confirming your email address.
      </p>
    </div>
  );
}

function SuccessView() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-slate-900">
        Email verified
      </h1>

      <p className="mt-3 text-sm text-slate-600">
        Your account is now active. Taking you to your
        dashboard...
      </p>

      <Link
        href="/dashboard"
        style={{ color: "#ffffff" }}
        className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold transition hover:bg-slate-800"
      >
        Go to dashboard
      </Link>
    </div>
  );
}

function ErrorView({
  message,
  code,
}: {
  message: string;
  code: string;
}) {
  /*
   * EXPIRED and USED mean the user needs a new link —
   * point them at /verify-email which has the resend
   * button. Other errors are generic.
   */
  const canResend = code === "EXPIRED" || code === "USED";

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-slate-900">
        Couldn&apos;t verify your email
      </h1>

      <p className="mt-3 text-sm text-slate-600">{message}</p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {canResend ? (
          <Link
            href="/verify-email"
            style={{ color: "#ffffff" }}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-slate-900 px-6 text-sm font-semibold transition hover:bg-slate-800"
          >
            Request a new link
          </Link>
        ) : (
          <Link
            href="/login"
            style={{ color: "#ffffff" }}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-slate-900 px-6 text-sm font-semibold transition hover:bg-slate-800"
          >
            Sign in
          </Link>
        )}

        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Try dashboard
        </Link>
      </div>
    </div>
  );
}