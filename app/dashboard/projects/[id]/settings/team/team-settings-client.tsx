// app/dashboard/projects/[id]/settings/team/team-settings-client.tsx

"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Collaborator = {
  id: string;
  invitedEmail: string;
  status: string;
  createdAt: Date | string;
  acceptedAt: Date | string | null;
  user: { id: string; name: string | null; email: string } | null;
};

export default function TeamSettingsClient({
  projectId,
  initialCollaborators,
  canInvite,
}: {
  projectId: string;
  initialCollaborators: Collaborator[];
  canInvite: boolean;
}) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(
        `/api/projects/${projectId}/collaborators`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Unable to invite.");
      }

      setEmail("");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to invite."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(collaboratorId: string) {
    setRevokingId(collaboratorId);
    setError("");

    try {
      const res = await fetch(
        `/api/projects/${projectId}/collaborators/${collaboratorId}`,
        { method: "DELETE" }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Unable to revoke access.");
      }

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to revoke access."
      );
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Invite form */}
      <section className="stripe-panel">
        <div className="px-6 py-6">
          {!canInvite && (
            <div className="stripe-alert stripe-alert-info mb-4">
              <div>
                <div className="font-semibold">
                  Sharing is a paid feature
                </div>
                <div className="mt-0.5">
                  Upgrade to invite collaborators to your projects.
                </div>
                <Link
                  href="/dashboard/billing"
                  className="stripe-link mt-2 inline-block"
                >
                  View plans →
                </Link>
              </div>
            </div>
          )}

          <form onSubmit={handleInvite} className="flex flex-col gap-3">
            <div>
              <label htmlFor="invite-email" className="stripe-label">
                Invite by email
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="collaborator@example.com"
                  disabled={submitting || !canInvite}
                  className="stripe-input flex-1"
                  style={{ minWidth: 240 }}
                />
                <button
                  type="submit"
                  disabled={
                    submitting || !canInvite || !email.trim()
                  }
                  className="btn-stripe btn-stripe-primary"
                >
                  {submitting ? "Sending..." : "Send invite"}
                </button>
              </div>
              <p
                className="mt-2 text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                They&apos;ll get view-only access to this project&apos;s
                audits and reports.
              </p>
            </div>

            {error && (
              <div className="stripe-alert stripe-alert-danger" role="alert">
                <div>{error}</div>
              </div>
            )}
          </form>
        </div>
      </section>

      {/* Collaborator list */}
      <section className="stripe-panel overflow-hidden">
        {initialCollaborators.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <h2 className="section-title mb-2">No collaborators yet</h2>
            <p
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Invite someone above to share this project.
            </p>
          </div>
        ) : (
          <div className="stripe-table-wrapper" style={{ border: 0, borderRadius: 0 }}>
            <table className="stripe-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }} aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {initialCollaborators.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="text-sm font-medium">
                        {c.invitedEmail}
                      </div>
                    </td>
                    <td>
                      <div className="text-sm">
                        {c.user?.name ?? "—"}
                      </div>
                    </td>
                    <td>
                      {c.status === "accepted" ? (
                        <span className="stripe-badge stripe-badge-success">
                          Accepted
                        </span>
                      ) : c.status === "revoked" ? (
                        <span className="stripe-badge stripe-badge-neutral">
                          Revoked
                        </span>
                      ) : (
                        <span className="stripe-badge stripe-badge-warning">
                          Pending
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => handleRevoke(c.id)}
                        disabled={revokingId === c.id}
                        className="btn-stripe btn-stripe-secondary"
                      >
                        {revokingId === c.id ? "Revoking..." : "Revoke"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}