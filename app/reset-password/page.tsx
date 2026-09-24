"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FormEvent,
  Suspense,
  useState,
} from "react";

import Navbar from "@/app/components/ui/navbar";
import Footer from "@/app/components/ui/footer";

function ResetPasswordForm() {
  const searchParams =
    useSearchParams();

  const token =
    searchParams.get("token");

  const [password, setPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState(false);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");

    if (!token) {
      setError(
        "This password reset link is invalid."
      );
      return;
    }

    if (password.length < 8) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Passwords do not match."
      );
      return;
    }

    setLoading(true);

    try {
      const response =
        await fetch(
          "/api/auth/reset-password",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              token,
              password,
            }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to reset password."
        );
      }

      setSuccess(true);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to reset password."
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-700">
          ✓
        </div>

        <h1 className="mt-5 text-2xl font-bold">
          Password updated
        </h1>

        <p className="mt-3 text-sm text-slate-600">
          Your password has been successfully changed.
        </p>

        <Link
          href="/login" style={{ color: "#ffffff" }}
          className="mt-6 inline-block rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="text-center">
        <h1 className="text-2xl font-bold">
          Create a new password
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          Choose a strong password for your account.
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
            htmlFor="password"
            className="mb-2 block text-sm font-medium"
          >
            New password
          </label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(
                event.target.value
              )
            }
            required
            minLength={8}
            autoComplete="new-password"
            className="h-12 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-2 block text-sm font-medium"
          >
            Confirm password
          </label>

          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(
                event.target.value
              )
            }
            required
            minLength={8}
            autoComplete="new-password"
            className="h-12 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !token}
          className="h-12 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading
            ? "Updating..."
            : "Update password"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <Suspense
              fallback={
                <div className="py-10 text-center text-sm text-slate-500">
                  Loading...
                </div>
              }
            >
              <ResetPasswordForm />
            </Suspense>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}