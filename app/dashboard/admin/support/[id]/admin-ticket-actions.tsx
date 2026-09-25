// app/dashboard/admin/support/[id]/admin-ticket-actions.tsx

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["open", "pending", "resolved", "closed"] as const;
const PRIORITIES = ["urgent", "high", "normal", "low"] as const;

type Status = (typeof STATUSES)[number];
type Priority = (typeof PRIORITIES)[number];

export default function AdminTicketActions({
  ticketId,
  status,
  priority,
}: {
  ticketId: string;
  status: string;
  priority: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [currentStatus, setCurrentStatus] = useState<Status>(
    (STATUSES as readonly string[]).includes(status)
      ? (status as Status)
      : "open"
  );
  const [currentPriority, setCurrentPriority] = useState<Priority>(
    (PRIORITIES as readonly string[]).includes(priority)
      ? (priority as Priority)
      : "normal"
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function update(patch: {
    status?: Status;
    priority?: Priority;
  }) {
    setSaving(true);
    setError("");

    try {
      const res = await fetch(
        `/api/support/tickets/${ticketId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Unable to update ticket.");
      }

      if (patch.status) setCurrentStatus(patch.status);
      if (patch.priority) setCurrentPriority(patch.priority);

      startTransition(() => router.refresh());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update ticket."
      );
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || isPending;

  return (
    <section className="stripe-panel">
      <div className="flex flex-wrap items-end gap-3 px-6 py-5">
        <div className="min-w-[140px]">
          <label htmlFor="admin-status" className="stripe-label">
            Status
          </label>
          <select
            id="admin-status"
            value={currentStatus}
            onChange={(e) => update({ status: e.target.value as Status })}
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

        <div className="min-w-[140px]">
          <label htmlFor="admin-priority" className="stripe-label">
            Priority
          </label>
          <select
            id="admin-priority"
            value={currentPriority}
            onChange={(e) =>
              update({ priority: e.target.value as Priority })
            }
            disabled={busy}
            className="stripe-select"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentStatus !== "resolved" && (
            <button
              type="button"
              onClick={() => update({ status: "resolved" })}
              disabled={busy}
              className="btn-stripe btn-stripe-secondary"
            >
              Mark resolved
            </button>
          )}

          {currentStatus !== "closed" ? (
            <button
              type="button"
              onClick={() => update({ status: "closed" })}
              disabled={busy}
              className="btn-stripe btn-stripe-secondary"
            >
              Close ticket
            </button>
          ) : (
            <button
              type="button"
              onClick={() => update({ status: "open" })}
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
          <div className="stripe-alert stripe-alert-danger w-full" role="alert">
            <div>{error}</div>
          </div>
        )}
      </div>
    </section>
  );
}