"use client";

import { useState, useEffect, useCallback } from "react";

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

  return (
    <div className="mt-4 rounded-lg border p-5" style={{ borderColor: "var(--border)" }}>
      <h3 className="text-sm font-semibold">Set up two-factor authentication</h3>

      <ol className="mt-3 flex flex-col gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        <li>
          <strong>1.</strong> Install an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password).
        </li>
        <li>
          <strong>2.</strong> Scan the QR code below.
        </li>
        <li>
          <strong>3.</strong> Enter the 6-digit code the app shows.
        </li>
      </ol>

      <div className="mt-4 flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrCode}
          alt="Two-factor authentication QR code"
          className="rounded-lg border"
          style={{ borderColor: "var(--border)", width: 180, height: 180 }}
        />
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Can&apos;t scan? Enter this key manually:
        </p>
        <code
          className="rounded px-2 py-1 font-mono text-xs"
          style={{ background: "var(--border-light)", color: "var(--text-primary)" }}
        >
          {secret}
        </code>
      </div>

      <div className="mt-5">
        <label htmlFor="totp-code" className="stripe-label">
          Verification code
        </label>
        <input
          id="totp-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className="stripe-input font-mono tracking-widest"
        />
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-stripe btn-stripe-secondary">
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

function RecoveryCodesPanel({
  codes,
  onDone,
}: {
  codes: string[];
  onDone: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div className="mt-4 rounded-lg border p-5" style={{ borderColor: "var(--border)" }}>
      <h3 className="text-sm font-semibold">Save your recovery codes</h3>
      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
        These codes are shown once. Store them somewhere safe. Each code can be used only once if you lose access to your authenticator app.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {codes.map((code) => (
          <code
            key={code}
            className="rounded px-3 py-2 text-center font-mono text-sm"
            style={{ background: "var(--border-light)", color: "var(--text-primary)" }}
          >
            {code}
          </code>
        ))}
      </div>

      <label className="mt-4 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-1"
        />
        <span style={{ color: "var(--text-secondary)" }}>
          I have saved these codes somewhere safe.
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