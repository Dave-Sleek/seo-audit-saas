"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type UserData = {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerifiedAt: string | null;
};

export default function UserEditForm({ user }: { user: UserData }) {
  const router = useRouter();

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [verified, setVerified] = useState(Boolean(user.emailVerifiedAt));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [resetLink, setResetLink] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          role,
          emailVerifiedAt: verified ? new Date().toISOString() : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to update user.");
      }

      setSuccess("Changes saved.");
      router.refresh();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateResetLink() {
    setResetLoading(true);
    setError("");
    setResetLink("");

    try {
      const response = await fetch(
        `/api/admin/users/${user.id}/password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "reset-link" }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to generate reset link.");
      }

      setResetLink(data.resetUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setResetLoading(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete ${user.name}? This will remove their account, projects, audits, and subscriptions. This cannot be undone.`
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to delete user.");
      }

      router.push("/dashboard/admin/users");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
    }
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess("Reset link copied to clipboard.");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      // ignore
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Feedback */}
      {error && (
        <div className="stripe-alert stripe-alert-danger" role="alert">
          <div>
            <div className="font-semibold">Error</div>
            <div className="mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {success && (
        <div className="stripe-alert stripe-alert-success" role="status">
          <div>{success}</div>
        </div>
      )}

      {/* Profile */}
      <section className="stripe-panel">
        <header
          className="border-b px-6 py-5"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="section-title">Profile</h2>
          <p className="section-description">
            Basic account information.
          </p>
        </header>

        <div className="grid gap-5 px-6 py-6 sm:grid-cols-2">
          <div>
            <label className="stripe-label">
              Name <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="stripe-input"
              required
            />
          </div>

          <div>
            <label className="stripe-label">
              Email <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="stripe-input"
              required
            />
          </div>

          <div>
            <label className="stripe-label">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="stripe-input"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <p
              className="mt-1.5 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Admins can access the admin dashboard and manage plans.
            </p>
          </div>

          <div>
            <label className="stripe-label">Email verified</label>
            <label className="flex cursor-pointer items-center gap-2 pt-2">
              <input
                type="checkbox"
                checked={verified}
                onChange={(e) => setVerified(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
              />
              <span
                className="text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                Mark email as verified
              </span>
            </label>
          </div>
        </div>

        <div
          className="flex flex-wrap items-center gap-3 border-t px-6 py-5"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            type="submit"
            disabled={saving}
            className="btn-stripe btn-stripe-primary"
          >
            {saving ? (
              <>
                <span className="spinner-stripe" aria-hidden="true" />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </section>

      {/* Password */}
      <section className="stripe-panel">
        <header
          className="border-b px-6 py-5"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="section-title">Password</h2>
          <p className="section-description">
            Generate a one-time reset link for this user. It expires in 1
            hour.
          </p>
        </header>

        <div className="flex flex-col gap-4 px-6 py-6">
          <div>
            <button
              type="button"
              onClick={handleGenerateResetLink}
              disabled={resetLoading}
              className="btn-stripe btn-stripe-secondary"
            >
              {resetLoading ? (
                <>
                  <span className="spinner-stripe" aria-hidden="true" />
                  Generating...
                </>
              ) : (
                "Generate reset link"
              )}
            </button>
          </div>

          {resetLink && (
            <div
              className="flex flex-wrap items-center gap-2 rounded-lg border p-3"
              style={{ borderColor: "var(--border)" }}
            >
              <code
                className="min-w-0 flex-1 truncate font-mono text-xs"
                style={{ color: "var(--text-secondary)" }}
                title={resetLink}
              >
                {resetLink}
              </code>

              <button
                type="button"
                onClick={() => handleCopy(resetLink)}
                className="btn-stripe btn-stripe-secondary shrink-0"
              >
                Copy
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Danger zone */}
      <section
        className="stripe-panel"
        style={{ borderColor: "var(--danger-light)" }}
      >
        <header
          className="border-b px-6 py-5"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="section-title" style={{ color: "var(--danger)" }}>
            Danger zone
          </h2>
          <p className="section-description">
            Irreversible actions. Please be certain.
          </p>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-6">
          <div>
            <div
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Delete user
            </div>
            <div
              className="mt-0.5 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Permanently removes this user and their data.
            </div>
          </div>

          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="btn-stripe btn-stripe-danger"
          >
            Delete user
          </button>
        </div>
      </section>
    </form>
  );
}