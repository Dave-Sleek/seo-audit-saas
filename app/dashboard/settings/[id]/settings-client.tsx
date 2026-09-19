"use client";

import { FormEvent, useState } from "react";

/* =========================================================
   TYPES
========================================================= */

type SettingsUser = {
  id: string;
  name: string;
  email: string;
};

type SettingsClientProps = {
  user: SettingsUser;
};

type SaveStatus = "idle" | "saving" | "success" | "error";

/* =========================================================
   COMPONENT
========================================================= */

export default function SettingsClient({ user }: SettingsClientProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState("");

  const dirty = name !== user.name || email !== user.email;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError("");

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to save changes.");
      }

      setStatus("success");

      // Auto-clear the success state after a few seconds.
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  function handleReset() {
    setName(user.name);
    setEmail(user.email);
    setStatus("idle");
    setError("");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ---------- HEADER ---------- */}
      <div>
        <div className="eyebrow mb-1">Account</div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">
          Manage your account details and preferences.
        </p>
      </div>

      {/* ---------- PROFILE ---------- */}
      <section className="stripe-panel">
        <header
          className="border-b px-6 py-5"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="section-title">Profile</h2>
          <p className="section-description">
            This information is visible to you throughout the dashboard.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="px-6 py-6">
          <div className="flex flex-col gap-5">
            {/* Name */}
            <div>
              <label htmlFor="name" className="stripe-label">
                Full name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                autoComplete="name"
                className="stripe-input"
                disabled={status === "saving"}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="stripe-label">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                autoComplete="email"
                className="stripe-input"
                disabled={status === "saving"}
              />
              <p
                className="mt-2 text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                Changing your email will require re-verification.
              </p>
            </div>
          </div>

          {/* Feedback */}
          {status === "error" && error && (
            <div
              className="stripe-alert stripe-alert-danger mt-5"
              role="alert"
            >
              <div>
                <div className="font-semibold">Could not save changes</div>
                <div className="mt-0.5">{error}</div>
              </div>
            </div>
          )}

          {status === "success" && (
            <div
              className="stripe-alert stripe-alert-success mt-5"
              role="status"
            >
              <div>
                <div className="font-semibold">Changes saved</div>
                <div className="mt-0.5">
                  Your profile has been updated.
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div
            className="mt-6 flex flex-wrap items-center gap-3 border-t pt-5"
            style={{ borderColor: "var(--border-light)" }}
          >
            <button
              type="submit"
              disabled={!dirty || status === "saving"}
              className="btn-stripe btn-stripe-primary"
            >
              {status === "saving" ? (
                <>
                  <span className="spinner-stripe" aria-hidden="true" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </button>

            <button
              type="button"
              onClick={handleReset}
              disabled={!dirty || status === "saving"}
              className="btn-stripe btn-stripe-secondary"
            >
              Reset
            </button>
          </div>
        </form>
      </section>

      {/* ---------- SECURITY (placeholder) ---------- */}
      <section className="stripe-panel">
        <header
          className="border-b px-6 py-5"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="section-title">Security</h2>
          <p className="section-description">
            Password, sessions, and two-factor authentication.
          </p>
        </header>

        <div className="px-6 py-6">
          <div
            className="rounded-lg p-4"
            style={{ background: "var(--border-light)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div
                  className="text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  Password
                </div>
                <div
                  className="mt-0.5 text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Last changed — not tracked yet.
                </div>
              </div>

              <button
                type="button"
                disabled
                className="btn-stripe btn-stripe-secondary"
              >
                Change password
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- DANGER ZONE (placeholder) ---------- */}
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

        <div className="px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Delete account
              </div>
              <div
                className="mt-0.5 text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                Permanently delete your account and all associated data.
              </div>
            </div>

            <button
              type="button"
              disabled
              className="btn-stripe btn-stripe-danger"
            >
              Delete account
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}