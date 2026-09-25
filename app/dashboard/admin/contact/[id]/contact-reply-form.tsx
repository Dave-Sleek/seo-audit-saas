// app/dashboard/admin/contact/[id]/contact-reply-form.tsx

"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function ContactReplyForm({
  messageId,
  recipientEmail,
}: {
  messageId: string;
  recipientEmail: string;
}) {
  const router = useRouter();

  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (body.trim().length < 2) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(
        `/api/admin/contact/${messageId}/replies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
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
        <label htmlFor="contact-reply" className="stripe-label">
          Reply to {recipientEmail}
        </label>
        <textarea
          id="contact-reply"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your response. It will be sent by email to the sender."
          rows={6}
          maxLength={5000}
          disabled={submitting}
          className="stripe-input resize-y"
        />
        <p
          className="mt-2 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          This reply is emailed to the sender. Their original message
          is included for context.
        </p>
      </div>

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