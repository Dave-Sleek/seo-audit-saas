"use client";

import { FormEvent, useState } from "react";

/* =========================================================
   TYPES
========================================================= */

export type AuditErrorCode =
  | "NO_SUBSCRIPTION"
  | "AUDIT_LIMIT_REACHED"
  | "PROJECT_LIMIT_REACHED"
  | "VALIDATION"
  | "SERVER"
  | null;

interface AuditFormProps {
  onSuccess?: (result: unknown) => void;
  onError?: (code: AuditErrorCode, message: string) => void;
  compact?: boolean;
}

/* =========================================================
   COMPONENT
========================================================= */

export default function AuditForm({
  onSuccess,
  onError,
  compact = false,
}: AuditFormProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<AuditErrorCode>(null);

  function fail(code: AuditErrorCode, message: string) {
    setError(message);
    setErrorCode(code);
    onError?.(code, message);
  }

  function clearError() {
    setError("");
    setErrorCode(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();

    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      fail("VALIDATION", "Please enter a website URL.");
      return;
    }

    let normalizedUrl = trimmedUrl;
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      new URL(normalizedUrl);
    } catch {
      fail("VALIDATION", "Please enter a valid website URL.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl }),
      });

      // Guard against non-JSON responses (404/500 HTML pages, redirects).
      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response", {
          status: response.status,
          contentType,
          preview: text.slice(0, 500),
        });
        fail(
          "SERVER",
          `Server returned ${response.status}. Please try again.`
        );
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        const code = result?.code as AuditErrorCode;

        if (
          code === "NO_SUBSCRIPTION" ||
          code === "AUDIT_LIMIT_REACHED" ||
          code === "PROJECT_LIMIT_REACHED"
        ) {
          fail(
            code,
            result?.error || "An active subscription is required."
          );
          return;
        }

        fail(
          "SERVER",
          result?.error ||
            result?.message ||
            "Unable to complete the SEO audit."
        );
        return;
      }

      onSuccess?.(result);
    } catch (err) {
      fail(
        "SERVER",
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const isUpgradeError =
    errorCode === "NO_SUBSCRIPTION" ||
    errorCode === "AUDIT_LIMIT_REACHED" ||
    errorCode === "PROJECT_LIMIT_REACHED";

  return (
    <form onSubmit={handleSubmit} className="w-full">
      {/* ---------- INPUT + BUTTON ---------- */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <span
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
            aria-hidden="true"
            style={{ color: "var(--text-subtle)" }}
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
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </span>

          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            disabled={loading}
            aria-label="Website URL"
            className="stripe-input"
            style={{ paddingLeft: 36 }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-stripe btn-stripe-primary"
        >
          {loading ? (
            <>
              <span className="spinner-stripe" aria-hidden="true" />
              Analyzing...
            </>
          ) : (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Analyze website
            </>
          )}
        </button>
      </div>

      {/* ---------- ERROR ---------- */}
      {error && (
        <div
          className={`stripe-alert mt-3 ${
            isUpgradeError
              ? "stripe-alert-warning"
              : "stripe-alert-danger"
          }`}
          role="alert"
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
            style={{ flexShrink: 0, marginTop: 1 }}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="flex-1">
            <div>{error}</div>

            {isUpgradeError && (
              <a
                href="/dashboard/subscription"
                className="btn-stripe btn-stripe-primary mt-3"
              >
                View plans
              </a>
            )}
          </div>
        </div>
      )}

      {/* ---------- HELPER TEXT ---------- */}
      {!compact && (
        <p
          className="mt-3 text-center text-xs sm:text-left"
          style={{ color: "var(--text-muted)" }}
        >
          Enter your website URL to check technical SEO, content,
          crawlability, structured data, social metadata, and more.
        </p>
      )}
    </form>
  );
}