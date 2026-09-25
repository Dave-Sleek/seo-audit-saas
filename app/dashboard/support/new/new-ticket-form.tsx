// app/dashboard/support/new/new-ticket-form.tsx

"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { value: "bug", label: "Bug report" },
  { value: "billing", label: "Billing issue" },
  { value: "feature", label: "Feature request" },
  { value: "other", label: "Something else" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

export default function NewTicketForm() {
  const router = useRouter();

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<Category>("bug");
  const [body, setBody] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, category, body }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Unable to submit ticket.");
      }

      router.push(`/dashboard/support/${data.ticket.id}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to submit ticket."
      );
      setSubmitting(false);
    }
  }

  const canSubmit =
    subject.trim().length >= 5 &&
    body.trim().length >= 20 &&
    !submitting;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Subject */}
      <div>
        <label htmlFor="subject" className="stripe-label">
          Subject
        </label>
        <input
          id="subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Short summary of the issue"
          maxLength={200}
          disabled={submitting}
          className="stripe-input"
        />
        <p
          className="mt-2 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          At least 5 characters. Be specific so we can help faster.
        </p>
      </div>

      {/* Category */}
      <div>
        <label htmlFor="category" className="stripe-label">
          Category
        </label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          disabled={submitting}
          className="stripe-select"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Body */}
      <div>
        <label htmlFor="body" className="stripe-label">
          Description
        </label>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What happened? What did you expect? Include any steps to reproduce, and the URL of the audit or project if relevant."
          rows={10}
          maxLength={5000}
          disabled={submitting}
          className="stripe-input resize-y"
          style={{ minHeight: 200 }}
        />
        <div
          className="mt-2 flex items-center justify-between text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          <span>At least 20 characters.</span>
          <span className="tabular-nums">
            {body.length} / 5000
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="stripe-alert stripe-alert-danger"
          role="alert"
        >
          <div>
            <div className="font-semibold">Could not submit ticket</div>
            <div className="mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div
        className="flex flex-wrap items-center gap-3 border-t pt-5"
        style={{ borderColor: "var(--border-light)" }}
      >
        <button
          type="submit"
          disabled={!canSubmit}
          className="btn-stripe btn-stripe-primary"
        >
          {submitting ? (
            <>
              <span className="spinner-stripe" aria-hidden="true" />
              Submitting...
            </>
          ) : (
            "Submit ticket"
          )}
        </button>

        <button
          type="button"
          onClick={() => router.push("/dashboard/support")}
          disabled={submitting}
          className="btn-stripe btn-stripe-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}