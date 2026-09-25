// app/dashboard/admin/support/[id]/admin-reply-form.tsx

"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminReplyForm({
  ticketId,
}: {
  ticketId: string;
}) {
  const router = useRouter();

  const [body, setBody] = useState("");
  const [markPending, setMarkPending] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (body.trim().length < 2) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(
        `/api/support/tickets/${ticketId}/admin-replies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, markPending }),
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Unable to send reply.");
      }

      setBody("");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to send reply."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="admin-reply" className="stripe-label">
          Reply to customer
        </label>
        <textarea
          id="admin-reply"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your response. The customer will be able to reply to this."
          rows={6}
          maxLength={5000}
          disabled={submitting}
          className="stripe-input resize-y"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={markPending}
          onChange={(e) => setMarkPending(e.target.checked)}
          disabled={submitting}
        />
        Set status to <strong>pending</strong> (waiting on customer)
      </label>

      {error && (
        <div className="stripe-alert stripe-alert-danger" role="alert">
          <div>{error}</div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || body.trim().length < 2}
          className="btn-stripe btn-stripe-primary"
        >
          {submitting ? (
            <>
              <span className="spinner-stripe" aria-hidden="true" />
              Sending...
            </>
          ) : (
            "Send reply"
          )}
        </button>
      </div>
    </form>
  );
}