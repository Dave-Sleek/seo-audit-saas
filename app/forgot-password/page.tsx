"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import Navbar from "@/app/components/ui/navbar";
import Footer from "@/app/components/ui/footer";

export default function ForgotPasswordPage() {
  const [email, setEmail] =
    useState("");

  const [submitted, setSubmitted] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response =
        await fetch(
          "/api/auth/forgot-password",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              email,
            }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to process your request."
        );
      }

      setSubmitted(true);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            {submitted ? (
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-700">
                  ✓
                </div>

                <h1 className="mt-5 text-2xl font-bold">
                  Check your email
                </h1>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  If an account exists for that email,
                  you'll receive instructions for resetting
                  your password.
                </p>

                <Link
                  href="/login"
                  className="mt-6 inline-block text-sm font-semibold text-blue-600"
                >
                  Back to login
                </Link>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <h1 className="text-2xl font-bold">
                    Forgot your password?
                  </h1>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Enter your email address and we'll
                    help you reset your password.
                  </p>
                </div>

                {error && (
                  <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

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
                      onChange={(event) =>
                        setEmail(
                          event.target.value
                        )
                      }
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="h-12 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="h-12 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {loading
                      ? "Sending..."
                      : "Send reset instructions"}
                  </button>
                </form>

                <p className="mt-7 text-center text-sm">
                  <Link
                    href="/login"
                    className="font-semibold text-blue-600"
                  >
                    Back to login
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}