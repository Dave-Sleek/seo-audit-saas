"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import Navbar from "@/app/components/ui/navbar";
import Footer from "@/app/components/ui/footer";

export default function LoginPage() {
  const router = useRouter();

  /* ---------- Credentials step ---------- */

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  /* ---------- 2FA step ---------- */

  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState("");

  /* ---------- Shared ---------- */

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inTwoFactorStep = challengeToken !== null;

  /* =========================================================
     STEP 1 — EMAIL + PASSWORD
  ========================================================= */

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to sign in.");
      }

      /*
       * If the account has 2FA enabled, the login route returns
       * { requiresTwoFactor: true, challengeToken } instead of
       * creating a session. Switch to the code step.
       */
      if (data.requiresTwoFactor && data.challengeToken) {
        setChallengeToken(data.challengeToken);
        setCode("");
        setLoading(false);
        return;
      }

      /* ---------- No 2FA — sign in complete ---------- */

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to sign in."
      );
      setLoading(false);
    }
  }

  /* =========================================================
     STEP 2 — TOTP / RECOVERY CODE
  ========================================================= */

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!challengeToken) return;

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeToken,
          code: code.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid code.");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Invalid code."
      );
      setCode("");
      setLoading(false);
    }
  }

  /* =========================================================
     CANCEL 2FA — GO BACK TO CREDENTIALS
  ========================================================= */

  function handleCancelTwoFactor() {
    setChallengeToken(null);
    setCode("");
    setError("");
    setPassword("");
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="text-center">
              <h1 className="text-2xl font-bold">
                {inTwoFactorStep
                  ? "Two-factor verification"
                  : "Welcome back"}
              </h1>

              <p className="mt-2 text-sm text-slate-600">
                {inTwoFactorStep
                  ? "Enter the 6-digit code from your authenticator app."
                  : "Sign in to access your SEO dashboard."}
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {/* =================================================
                STEP 1 — EMAIL + PASSWORD
            ================================================= */}

            {!inTwoFactorStep && (
              <form
                onSubmit={handleSubmit}
                className="mt-8 space-y-5"
              >
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium"
                  >
                    Email address
                  </label>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    disabled={loading}
                    className="h-12 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium"
                    >
                      Password
                    </label>

                    <Link
                      href="/forgot-password"
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Your password"
                    disabled={loading}
                    className="h-12 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Signing in..." : "Sign in"}
                </button>
              </form>
            )}

            {/* =================================================
                STEP 2 — TOTP / RECOVERY CODE
            ================================================= */}

            {inTwoFactorStep && (
              <form
                onSubmit={handleVerify}
                className="mt-8 space-y-5"
              >
                <div>
                  <label
                    htmlFor="code"
                    className="mb-2 block text-sm font-medium"
                  >
                    Verification code
                  </label>

                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    value={code}
                    onChange={(e) => {
                      /*
                       * Accept either 6 digits (TOTP) or 8 hex
                       * characters (recovery code). Strip anything
                       * else, uppercase the result.
                       */
                      const cleaned = e.target.value
                        .replace(/[^0-9a-fA-F]/g, "")
                        .toUpperCase();
                      setCode(cleaned);
                    }}
                    maxLength={8}
                    placeholder="000000"
                    disabled={loading}
                    className="h-12 w-full rounded-lg border border-slate-300 px-4 text-center font-mono text-lg tracking-widest outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                  />

                  <p className="mt-2 text-xs text-slate-500">
                    Enter the 6-digit code from your authenticator
                    app, or one of your recovery codes.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={
                    loading ||
                    (code.length !== 6 && code.length !== 8)
                  }
                  className="h-12 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Verifying..." : "Verify and sign in"}
                </button>

                <button
                  type="button"
                  onClick={handleCancelTwoFactor}
                  disabled={loading}
                  className="h-11 w-full rounded-lg border border-slate-300 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Use a different account
                </button>
              </form>
            )}

            {!inTwoFactorStep && (
              <p className="mt-7 text-center text-sm text-slate-600">
                Don&apos;t have an account?{" "}
                <Link
                  href="/register"
                  className="font-semibold text-blue-600 hover:text-blue-700"
                >
                  Create one
                </Link>
              </p>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}