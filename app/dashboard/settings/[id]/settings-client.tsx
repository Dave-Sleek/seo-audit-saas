"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

/* =========================================================
   TYPES
========================================================= */

type TwoFactorMethod = "totp" | "email";

type SettingsUser = {
  id: string;
  name: string;
  email: string;
  twoFactorEnabledAt: string | Date | null;
  twoFactorMethod: TwoFactorMethod | null;
};

type SettingsClientProps = {
  user: SettingsUser;
};

type SaveStatus = "idle" | "saving" | "success" | "error";

type TwoFactorState =
  | { status: "idle" }
  | { status: "choosing" }
  | { status: "email-sending" }
  | { status: "email-sent" }
  | { status: "email-success" }
  | {
      status: "setup";
      qrCode: string;
      secret: string;
      otpauth: string;
    }
  | {
      status: "verifying";
      qrCode: string;
      secret: string;
      otpauth: string;
    }
  | { status: "recovery"; codes: string[] }
  | { status: "disabling" }
  | { status: "disable-success" }
  | { status: "error"; message: string };

/* =========================================================
   COMPONENT
========================================================= */

export default function SettingsClient({ user }: SettingsClientProps) {
  const router = useRouter();

  /* ---------- Profile ---------- */

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState("");

  const dirty = name !== user.name || email !== user.email;

  /* ---------- 2FA ---------- */

  const [twoFactor, setTwoFactor] = useState<TwoFactorState>({
    status: "idle",
  });

  const twoFactorEnabled = Boolean(user.twoFactorEnabledAt);

  /* =========================================================
     PROFILE ACTIONS
  ========================================================= */

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
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    }
  }

  function handleReset() {
    setName(user.name);
    setEmail(user.email);
    setStatus("idle");
    setError("");
  }

  /* =========================================================
     2FA ACTIONS
  ========================================================= */

  function openMethodChooser() {
    setTwoFactor({ status: "choosing" });
  }

  function openDisableDialog() {
    setTwoFactor({ status: "disabling" });
  }

  function cancelTwoFactor() {
    setTwoFactor({ status: "idle" });
  }

  function finishTwoFactorChange() {
    setTwoFactor({ status: "idle" });
    router.refresh();
  }

  /* ---------- TOTP ---------- */

  async function startTotpSetup() {
    setTwoFactor({ status: "idle" });

    try {
      const res = await fetch("/api/account/2fa/setup", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setTwoFactor({
          status: "error",
          message: data.error ?? "Unable to start setup.",
        });
        return;
      }

      setTwoFactor({
        status: "setup",
        qrCode: data.qrCode,
        secret: data.secret,
        otpauth: data.otpauth,
      });
    } catch {
      setTwoFactor({
        status: "error",
        message: "Unable to start setup. Please try again.",
      });
    }
  }

  async function verifyTotpSetup(code: string) {
    if (twoFactor.status !== "setup") return;

    const current = twoFactor;
    setTwoFactor({ ...current, status: "verifying" });

    try {
      const res = await fetch("/api/account/2fa/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setTwoFactor({
          status: "error",
          message: data.error ?? "Invalid code. Please try again.",
        });
        return;
      }

      setTwoFactor({
        status: "recovery",
        codes: data.recoveryCodes ?? [],
      });
    } catch {
      setTwoFactor({
        status: "error",
        message: "Verification failed. Please try again.",
      });
    }
  }

  /* ---------- Email OTP ---------- */

  async function startEmailEnrollment() {
    setTwoFactor({ status: "email-sending" });

    try {
      const res = await fetch("/api/account/2fa/email/enroll", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setTwoFactor({
          status: "error",
          message: data.error ?? "Unable to send verification code.",
        });
        return;
      }

      setTwoFactor({ status: "email-sent" });
    } catch {
      setTwoFactor({
        status: "error",
        message: "Unable to send verification code. Please try again.",
      });
    }
  }

  /* =========================================================
     RENDER
  ========================================================= */

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

          {status === "error" && error && (
            <div
              className="stripe-alert stripe-alert-danger mt-5"
              role="alert"
            >
              <div>
                <div className="font-semibold">
                  Could not save changes
                </div>
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

      {/* ---------- SECURITY ---------- */}
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

        <div className="flex flex-col gap-4 px-6 py-6">
          {/* Password */}
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

          {/* 2FA idle */}
          {twoFactor.status === "idle" && (
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
                    Two-factor authentication
                  </div>
                  <div
                    className="mt-0.5 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {twoFactorEnabled
                      ? user.twoFactorMethod === "email"
                        ? "Enabled via email. You'll receive a code at sign-in."
                        : "Enabled via authenticator app. You'll enter a code at sign-in."
                      : "Add an extra layer of security at sign-in."}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {twoFactorEnabled ? (
                    <>
                      <span className="stripe-badge stripe-badge-success">
                        Enabled
                      </span>
                      <button
                        type="button"
                        onClick={openDisableDialog}
                        className="btn-stripe btn-stripe-secondary"
                      >
                        Disable 2FA
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={openMethodChooser}
                      className="btn-stripe btn-stripe-primary"
                    >
                      Enable 2FA
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2FA method chooser */}
          {twoFactor.status === "choosing" && (
            <MethodChooser
              onSelectEmail={startEmailEnrollment}
              onSelectTotp={startTotpSetup}
              onCancel={cancelTwoFactor}
            />
          )}

          {/* Email: sending */}
          {twoFactor.status === "email-sending" && (
            <div
              className="rounded-lg border p-4 text-sm"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-muted)",
              }}
            >
              Sending verification code...
            </div>
          )}

          {/* Email: code sent, awaiting input */}
          {twoFactor.status === "email-sent" && (
            <EmailVerifyDialog
              email={user.email}
              onCancel={cancelTwoFactor}
              onDone={() => {
                setTwoFactor({ status: "email-success" });
                setTimeout(() => finishTwoFactorChange(), 1200);
              }}
            />
          )}

          {/* Email: success */}
          {twoFactor.status === "email-success" && (
            <TwoFactorSuccessPanel
              method="email"
              onContinue={finishTwoFactorChange}
            />
          )}

          {/* TOTP setup */}
          {twoFactor.status === "setup" && (
            <TwoFactorSetupDialog
              qrCode={twoFactor.qrCode}
              secret={twoFactor.secret}
              onCancel={cancelTwoFactor}
              onVerify={verifyTotpSetup}
            />
          )}

          {twoFactor.status === "verifying" && (
            <div
              className="rounded-lg border p-4 text-sm"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-muted)",
              }}
            >
              Verifying code...
            </div>
          )}

          {twoFactor.status === "recovery" && (
            <RecoveryCodesPanel
              codes={twoFactor.codes}
              onDone={finishTwoFactorChange}
            />
          )}

          {/* Disable 2FA */}
          {twoFactor.status === "disabling" && (
            <DisableTwoFactorDialog
              email={user.email}
              onCancel={cancelTwoFactor}
              onDone={() => {
                setTwoFactor({ status: "disable-success" });
                setTimeout(() => finishTwoFactorChange(), 1200);
              }}
            />
          )}

          {twoFactor.status === "disable-success" && (
            <div
              className="rounded-lg border p-5"
              style={{
                borderColor: "var(--success)",
                background: "var(--success-light, var(--surface))",
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "var(--success)", color: "#fff" }}
                  aria-hidden="true"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <div>
                  <div
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Two-factor authentication disabled
                  </div>
                  <div
                    className="mt-0.5 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    You can re-enable it at any time from this page.
                  </div>
                </div>
              </div>
            </div>
          )}

          {twoFactor.status === "error" && (
            <TwoFactorErrorPanel
              message={twoFactor.message}
              onBack={cancelTwoFactor}
            />
          )}
        </div>
      </section>

      {/* ---------- DANGER ZONE ---------- */}
      <section
        className="stripe-panel"
        style={{ borderColor: "var(--danger-light)" }}
      >
        <header
          className="border-b px-6 py-5"
          style={{ borderColor: "var(--border)" }}
        >
          <h2
            className="section-title"
            style={{ color: "var(--danger)" }}
          >
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
                Permanently delete your account and all associated
                data.
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

/* =========================================================
   METHOD CHOOSER
========================================================= */

function MethodChooser({
  onSelectEmail,
  onSelectTotp,
  onCancel,
}: {
  onSelectEmail: () => void;
  onSelectTotp: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="rounded-lg border p-5"
      style={{ borderColor: "var(--border)" }}
    >
      <h3
        className="text-sm font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        Choose a two-factor method
      </h3>

      <p
        className="mt-1 text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        You&apos;ll be asked for a code at sign-in. Pick whichever is
        more convenient.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <button
          type="button"
          onClick={onSelectEmail}
          className="flex items-start gap-3 rounded-lg border p-4 text-left transition hover:bg-slate-50"
          style={{ borderColor: "var(--border)" }}
        >
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{
              background: "var(--primary-light)",
              color: "var(--primary)",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m2 7 10 6 10-6" />
            </svg>
          </span>

          <div className="flex-1">
            <div
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Email verification
            </div>
            <div
              className="mt-0.5 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              We&apos;ll email you a 6-digit code each time you sign
              in. No app required.
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onSelectTotp}
          className="flex items-start gap-3 rounded-lg border p-4 text-left transition hover:bg-slate-50"
          style={{ borderColor: "var(--border)" }}
        >
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{
              background: "var(--primary-light)",
              color: "var(--primary)",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="5" y="2" width="14" height="20" rx="2" />
              <path d="M12 18h.01" />
            </svg>
          </span>

          <div className="flex-1">
            <div
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Authenticator app
            </div>
            <div
              className="mt-0.5 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Use Google Authenticator, 1Password, Authy, or any
              TOTP-compatible app.
            </div>
          </div>
        </button>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="btn-stripe btn-stripe-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   EMAIL VERIFY DIALOG
========================================================= */

function EmailVerifyDialog({
  email,
  onCancel,
  onDone,
}: {
  email: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  const maskedEmail = email.replace(
    /^(.{1,2})(.*)(@.*)$/,
    (_, a, b, c) => `${a}${"•".repeat(b.length)}${c}`
  );

  async function handleVerify() {
    if (submitting || succeeded) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/account/2fa/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Invalid code.");
      }

      setSucceeded(true);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code.");
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (submitting || succeeded) return;

    setResent(false);
    try {
      await fetch("/api/account/2fa/email/enroll", { method: "POST" });
      setResent(true);
    } catch {
      // ignore
    }
  }

  if (succeeded) {
    return (
      <div
        className="rounded-lg border p-5"
        style={{
          borderColor: "var(--success)",
          background: "var(--success-light, var(--surface))",
        }}
      >
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--success)", color: "#fff" }}
            aria-hidden="true"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>

          <div>
            <div
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Two-factor authentication enabled
            </div>
            <div
              className="mt-0.5 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Your account now requires a code at sign-in.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border p-5"
      style={{ borderColor: "var(--border)" }}
    >
      <h3
        className="text-sm font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        Verify your email
      </h3>

      <p
        className="mt-1 text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        We sent a 6-digit code to <strong>{maskedEmail}</strong>.
        Enter it below to enable email two-factor authentication.
      </p>

      <div className="mt-5">
        <label htmlFor="email-2fa-code" className="stripe-label">
          Verification code
        </label>

        <input
          id="email-2fa-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          placeholder="000000"
          className="stripe-input text-center font-mono tracking-widest"
          disabled={submitting}
        />
      </div>

      {error && (
        <div
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      {resent && (
        <div
          className="mt-3 text-xs"
          style={{ color: "var(--success)" }}
        >
          A new code has been sent.
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleResend}
          disabled={submitting}
          className="text-xs font-medium"
          style={{ color: "var(--primary)" }}
        >
          Resend code
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="btn-stripe btn-stripe-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleVerify}
            disabled={submitting || code.length !== 6}
            className="btn-stripe btn-stripe-primary"
          >
            {submitting ? "Verifying..." : "Verify and enable"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   TWO-FACTOR SUCCESS PANEL
========================================================= */

function TwoFactorSuccessPanel({
  method,
  onContinue,
}: {
  method: "email" | "totp";
  onContinue: () => void;
}) {
  return (
    <div
      className="rounded-lg border p-5"
      style={{
        borderColor: "var(--success)",
        background: "var(--success-light, var(--surface))",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--success)", color: "#fff" }}
          aria-hidden="true"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>

        <div>
          <div
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Two-factor authentication enabled
          </div>
          <div
            className="mt-0.5 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            {method === "email"
              ? "You'll receive a 6-digit code by email at each sign-in."
              : "You'll enter a 6-digit code from your authenticator app at each sign-in."}
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          className="btn-stripe btn-stripe-primary"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   DISABLE TWO-FACTOR DIALOG
========================================================= */

function DisableTwoFactorDialog({
  email,
  onCancel,
  onDone,
}: {
  email: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);

  const maskedEmail = email.replace(
    /^(.{1,2})(.*)(@.*)$/,
    (_, a, b, c) => `${a}${"•".repeat(b.length)}${c}`
  );

  /* ---------- Step 1: verify password + send code ---------- */

  async function handleSendCode() {
    if (sending || submitting) return;

    setSending(true);
    setError("");
    setResent(false);

    try {
      const res = await fetch("/api/account/2fa/disable/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to send code.");
      }

      if (codeSent) {
        setResent(true);
      } else {
        setCodeSent(true);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to send code."
      );
    } finally {
      setSending(false);
    }
  }

  /* ---------- Step 2: verify code + disable ---------- */

  async function handleDisable() {
    if (submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/account/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, code }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to disable 2FA.");
      }

      onDone();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to disable 2FA."
      );
      setSubmitting(false);
    }
  }

  return (
    <div
      className="rounded-lg border p-5"
      style={{ borderColor: "var(--danger)", background: "var(--surface)" }}
    >
      <h3
        className="text-sm font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        Disable two-factor authentication
      </h3>

      <p
        className="mt-1 text-xs leading-relaxed"
        style={{ color: "var(--text-muted)" }}
      >
        {codeSent
          ? `We sent a 6-digit code to ${maskedEmail}. Enter it along with your password to confirm.`
          : "Confirm your password to receive a verification code by email."}
      </p>

      <div className="mt-5 flex flex-col gap-4">
        {/* Password */}
        <div>
          <label htmlFor="disable-password" className="stripe-label">
            Current password
          </label>
          <input
            id="disable-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            disabled={sending || submitting}
            className="stripe-input"
          />
        </div>

        {/* Send code button (before code is sent) */}
        {!codeSent && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSendCode}
              disabled={sending || !password}
              className="btn-stripe btn-stripe-primary"
            >
              {sending ? "Sending code..." : "Send verification code"}
            </button>
          </div>
        )}

        {/* Code field (after code is sent) */}
        {codeSent && (
          <div>
            <label htmlFor="disable-code" className="stripe-label">
              Verification code
            </label>
            <input
              id="disable-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="000000"
              autoFocus
              disabled={submitting}
              className="stripe-input text-center font-mono tracking-widest"
            />

            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={handleSendCode}
                disabled={sending || submitting}
                className="text-xs font-medium"
                style={{ color: "var(--primary)" }}
              >
                {sending ? "Sending..." : "Resend code"}
              </button>

              {resent && (
                <span
                  className="text-xs"
                  style={{ color: "var(--success)" }}
                >
                  Code resent.
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={sending || submitting}
          className="btn-stripe btn-stripe-secondary"
        >
          Cancel
        </button>

        {codeSent && (
          <button
            type="button"
            onClick={handleDisable}
            disabled={submitting || !password || code.length !== 6}
            className="btn-stripe btn-stripe-danger"
          >
            {submitting ? "Disabling..." : "Disable 2FA"}
          </button>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   TWO-FACTOR ERROR PANEL
========================================================= */

function TwoFactorErrorPanel({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  /*
   * "Already enabled" isn't really an error — it means the
   * account is in the desired state (which can happen if a
   * concurrent enrollment won the race, or the user
   * double-submitted). Show it as a positive message.
   */
  const isAlreadyEnabled = message
    .toLowerCase()
    .includes("already enabled");

  return (
    <div
      className={
        isAlreadyEnabled
          ? "stripe-alert stripe-alert-success"
          : "stripe-alert stripe-alert-danger"
      }
      role="alert"
    >
      <div>
        <div className="font-semibold">
          {isAlreadyEnabled
            ? "Two-factor authentication is enabled"
            : "Two-factor setup failed"}
        </div>
        <div className="mt-0.5">{message}</div>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="btn-stripe btn-stripe-secondary mt-3"
      >
        {isAlreadyEnabled ? "Done" : "Back"}
      </button>
    </div>
  );
}

/* =========================================================
   TWO-FACTOR SETUP DIALOG (TOTP)
========================================================= */

function TwoFactorSetupDialog({
  qrCode,
  secret,
  onCancel,
  onVerify,
}: {
  qrCode: string;
  secret: string;
  onCancel: () => void;
  onVerify: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div
      className="rounded-lg border p-5"
      style={{ borderColor: "var(--border)" }}
    >
      <h3
        className="text-sm font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        Set up an authenticator app
      </h3>

      <ol
        className="mt-3 flex flex-col gap-1 text-sm"
        style={{ color: "var(--text-secondary)" }}
      >
        <li>
          <strong>1.</strong> Install an authenticator app — Google
          Authenticator, Microsoft Authenticator, 1Password, or Authy.
        </li>
        <li>
          <strong>2.</strong> Scan the QR code below.
        </li>
        <li>
          <strong>3.</strong> Enter the 6-digit code the app shows.
        </li>
      </ol>

      <div className="mt-5 flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrCode}
          alt="Two-factor authentication QR code"
          className="rounded-lg border"
          style={{
            borderColor: "var(--border)",
            width: 180,
            height: 180,
          }}
        />

        <p
          className="text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          Can&apos;t scan? Enter this key manually:
        </p>

        <div className="flex items-center gap-2">
          <code
            className="rounded px-2 py-1 font-mono text-xs"
            style={{
              background: "var(--border-light)",
              color: "var(--text-primary)",
            }}
          >
            {secret}
          </code>

          <button
            type="button"
            onClick={copySecret}
            className="text-xs font-medium"
            style={{ color: "var(--primary)" }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="mt-6">
        <label htmlFor="totp-code" className="stripe-label">
          Verification code
        </label>

        <input
          id="totp-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          placeholder="000000"
          className="stripe-input text-center font-mono tracking-widest"
        />
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-stripe btn-stripe-secondary"
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={code.length !== 6}
          onClick={() => onVerify(code)}
          className="btn-stripe btn-stripe-primary"
        >
          Verify and enable
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   RECOVERY CODES PANEL
========================================================= */

function RecoveryCodesPanel({
  codes,
  onDone,
}: {
  codes: string[];
  onDone: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  function download() {
    const blob = new Blob(
      [
        `Two-factor recovery codes for ${new Date().toISOString()}\n\n`,
        ...codes.map((c) => `${c}\n`),
        "\nEach code can be used once.\n",
      ],
      { type: "text/plain" }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="rounded-lg border p-5"
      style={{ borderColor: "var(--warning-light, var(--border))" }}
    >
      <h3
        className="text-sm font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        Save your recovery codes
      </h3>

      <p
        className="mt-1 text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        These codes are shown once. Store them somewhere safe. Each
        code can be used once if you lose access to your email or
        authenticator app.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {codes.map((code) => (
          <code
            key={code}
            className="rounded px-3 py-2 text-center font-mono text-sm"
            style={{
              background: "var(--border-light)",
              color: "var(--text-primary)",
            }}
          >
            {code}
          </code>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copyAll}
          className="btn-stripe btn-stripe-secondary"
        >
          {copied ? "Copied" : "Copy all"}
        </button>

        <button
          type="button"
          onClick={download}
          className="btn-stripe btn-stripe-secondary"
        >
          Download
        </button>
      </div>

      <label className="mt-5 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-1"
        />
        <span style={{ color: "var(--text-secondary)" }}>
          I have saved these codes somewhere safe. I understand they
          won&apos;t be shown again.
        </span>
      </label>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={!acknowledged}
          onClick={onDone}
          className="btn-stripe btn-stripe-primary"
        >
          Done
        </button>
      </div>
    </div>
  );
}