"use client";

import { useState } from "react";

export default function ResendVerificationButton() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleResend() {
    if (sending) return;

    setSending(true);
    setError("");
    setSent(false);

    try {
      const res = await fetch(
        "/api/auth/send-verification-email",
        { method: "POST" }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          data?.error || "Unable to send verification email."
        );
      }

      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send verification email."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleResend}
        disabled={sending}
        className="btn-stripe btn-stripe-primary"
      >
        {sending ? "Sending..." : "Resend verification email"}
      </button>

      {sent && (
        <p className="text-xs text-emerald-600">
          Verification email sent. Check your inbox.
        </p>
      )}

      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}