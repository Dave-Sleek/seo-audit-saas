"use client";

import { useState } from "react";
import Link from "next/link";

type Props = {
  planId: string;
  planSlug: string;
  planName: string;
  isFree: boolean;
  isFeatured: boolean;
};

export default function SubscribeButton({
  planId,
  planSlug,
  planName,
  isFree,
  isFeatured,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const buttonClass = `mt-6 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-center text-sm font-semibold transition ${
    isFeatured
      ? "btn-stripe btn-stripe-primary"
      : "btn-stripe btn-stripe-secondary"
  }`;

  const buttonStyle = isFeatured
    ? {
        background: "var(--primary)",
        color: "#fff",
        borderColor: "var(--primary)",
      }
    : undefined;

  if (isFree) {
    return (
      <Link href="/register" className={buttonClass} style={buttonStyle}>
        Start for free
      </Link>
    );
  }

  async function handleSubscribe() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          planSlug, // send both — API can prefer planId
        }),
      });

      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response", {
          status: response.status,
          preview: text.slice(0, 300),
        });
        throw new Error(
          `Server returned ${response.status}. Please try again.`
        );
      }

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = `/login?redirect=${encodeURIComponent(
            "/pricing"
          )}`;
          return;
        }

        throw new Error(
          data?.error || "Unable to start checkout. Please try again."
        );
      }

      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }

      throw new Error("Server did not return a checkout URL.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={handleSubscribe}
        disabled={loading}
        className={buttonClass}
        style={buttonStyle}
      >
        {loading ? (
          <>
            <span className="spinner-stripe" aria-hidden="true" />
            Redirecting...
          </>
        ) : (
          <>Choose {planName}</>
        )}
      </button>

      {error && (
        <p
          className="mt-2 text-center text-xs"
          style={{ color: "var(--danger)" }}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}