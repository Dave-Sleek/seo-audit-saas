// app/dashboard/admin/contact/[id]/contact-actions.tsx

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["unread", "read", "replied", "closed"] as const;
type Status = (typeof STATUSES)[number];

export default function ContactActions({
  messageId,
  status,
}: {
  messageId: string;
  status: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentStatus, setCurrentStatus] = useState<Status>(
    (STATUSES as readonly string[]).includes(status)
      ? (status as Status)
      : "unread"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function update(next: Status) {
    setSaving(true);
    setError("");

    try {
      const res = await fetch(
        `/api/admin/contact/${messageId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Unable to update status.");
      }

      setCurrentStatus(next);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update status."
      );
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || isPending;

  return (
    <section className="stripe-panel">
      <div className="flex flex-wrap items-end gap-3 px-6 py-5">
        <div className="min-w-[160px]">
          <label htmlFor="contact-status" className="stripe-label">
            Status
          </label>
          <select
            id="contact-status"
            value={currentStatus}
            onChange={(e) => update(e.target.value as Status)}
            disabled={busy}
            className="stripe-select"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentStatus !== "replied" && (
            <button
              type="button"
              onClick={() => update("replied")}
              disabled={busy}
              className="btn-stripe btn-stripe-secondary"
            >
              Mark replied
            </button>
          )}

          {currentStatus !== "closed" ? (
            <button
              type="button"
              onClick={() => update("closed")}
              disabled={busy}
              className="btn-stripe btn-stripe-secondary"
            >
              Close
            </button>
          ) : (
            <button
              type="button"
              onClick={() => update("read")}
              disabled={busy}
              className="btn-stripe btn-stripe-secondary"
            >
              Reopen
            </button>
          )}
        </div>

        {busy && (
          <span className="flex items-center gap-2 text-xs text-slate-500">
            <span className="spinner-stripe" aria-hidden="true" />
            Saving...
          </span>
        )}

        {error && (
          <div
            className="stripe-alert stripe-alert-danger w-full"
            role="alert"
          >
            <div>{error}</div>
          </div>
        )}
      </div>
    </section>
  );
}