"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  CONSENT_EVENT,
  DEFAULT_CONSENT,
  dispatchConsentChange,
  readConsent,
  writeConsent,
  type ConsentCategories,
  type ConsentRecord,
} from "@/app/lib/cookie-consent";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [draft, setDraft] = useState<ConsentCategories>(DEFAULT_CONSENT);

  /* ---------- Initial check (client-only) ---------- */

  useEffect(() => {
    const existing = readConsent();

    if (!existing) {
      setVisible(true);
    } else {
      setDraft(existing.categories);
    }

    // React to changes made from the settings page.
    function onChange(event: Event) {
      const record = (event as CustomEvent<ConsentRecord>).detail;
      if (record) setDraft(record.categories);
      setVisible(false);
    }

    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  /* ---------- Actions ---------- */

  function commit(categories: ConsentCategories) {
    const record = writeConsent(categories);
    dispatchConsentChange(record);
    setVisible(false);
    setShowDetails(false);
  }

  function acceptAll() {
    commit({ essential: true, analytics: true, marketing: true });
  }

  function rejectAll() {
    commit({ essential: true, analytics: false, marketing: false });
  }

  function savePreferences() {
    commit({
      essential: true,
      analytics: draft.analytics,
      marketing: draft.marketing,
    });
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-6 sm:pb-6"
    >
      <div
        className="mx-auto max-w-4xl rounded-xl border p-4 shadow-lg sm:p-5"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        {!showDetails ? (
          /* ---------- Compact view ---------- */
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                We use cookies
              </p>
              <p className="mt-1">
                Essential cookies keep you signed in. We&apos;d also like
                to use analytics to understand how the app is used. See
                our{" "}
                <Link href="/legal/cookies" className="stripe-link">
                  cookie policy
                </Link>
                .
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDetails(true)}
                className="btn-stripe btn-stripe-secondary"
              >
                Customize
              </button>
              <button
                type="button"
                onClick={rejectAll}
                className="btn-stripe btn-stripe-secondary"
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="btn-stripe btn-stripe-primary"
              >
                Accept all
              </button>
            </div>
          </div>
        ) : (
          /* ---------- Detailed view ---------- */
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Cookie preferences
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Choose which categories we may use. Essential cookies
                cannot be disabled — the app won&apos;t work without them.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <CategoryRow
                title="Strictly necessary"
                description="Sign-in session, CSRF protection, load balancing."
                checked
                disabled
                onChange={() => {}}
              />
              <CategoryRow
                title="Analytics"
                description="Anonymous usage measurement to improve the product."
                checked={draft.analytics}
                onChange={(v) => setDraft((d) => ({ ...d, analytics: v }))}
              />
              <CategoryRow
                title="Marketing"
                description="Third-party pixels for retargeting and ad measurement."
                checked={draft.marketing}
                onChange={(v) => setDraft((d) => ({ ...d, marketing: v }))}
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="btn-stripe btn-stripe-secondary"
              >
                Back
              </button>
              <button
                type="button"
                onClick={rejectAll}
                className="btn-stripe btn-stripe-secondary"
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="btn-stripe btn-stripe-primary"
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={savePreferences}
                className="btn-stripe btn-stripe-primary"
              >
                Save preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   CATEGORY ROW
========================================================= */

function CategoryRow({
  title,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
      style={{
        borderColor: "var(--border-light)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <div className="flex-1">
        <div
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
          {disabled && (
            <span
              className="ml-2 text-xs font-normal"
              style={{ color: "var(--text-muted)" }}
            >
              (always on)
            </span>
          )}
        </div>
        <div
          className="mt-0.5 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {description}
        </div>
      </div>
    </label>
  );
}