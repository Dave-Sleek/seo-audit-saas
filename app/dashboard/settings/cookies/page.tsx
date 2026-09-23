"use client";

import { useEffect, useState } from "react";

import {
  DEFAULT_CONSENT,
  dispatchConsentChange,
  readConsent,
  writeConsent,
  type ConsentCategories,
} from "@/app/lib/cookie-consent";

export default function CookieSettingsPage() {
  const [draft, setDraft] = useState<ConsentCategories>(DEFAULT_CONSENT);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const existing = readConsent();
    if (existing) setDraft(existing.categories);
  }, []);

  function save() {
    const record = writeConsent(draft);
    dispatchConsentChange(record);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="eyebrow mb-1">Account</div>
        <h1 className="page-title">Cookie preferences</h1>
        <p className="page-subtitle">
          Control which cookies this app is allowed to use.
        </p>
      </div>

      <section className="stripe-panel p-6">
        <div className="flex flex-col gap-4">
          <label
            className="flex items-start gap-3 rounded-lg border p-3"
            style={{ borderColor: "var(--border-light)", opacity: 0.7 }}
          >
            <input type="checkbox" checked disabled className="mt-0.5" />
            <div>
              <div className="text-sm font-medium">Strictly necessary</div>
              <div className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                Required to sign you in and keep the app secure.
              </div>
            </div>
          </label>

          <label
            className="flex items-start gap-3 rounded-lg border p-3"
            style={{ borderColor: "var(--border-light)" }}
          >
            <input
              type="checkbox"
              checked={draft.analytics}
              onChange={(e) =>
                setDraft((d) => ({ ...d, analytics: e.target.checked }))
              }
              className="mt-0.5"
            />
            <div>
              <div className="text-sm font-medium">Analytics</div>
              <div className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                Anonymous usage measurement.
              </div>
            </div>
          </label>

          <label
            className="flex items-start gap-3 rounded-lg border p-3"
            style={{ borderColor: "var(--border-light)" }}
          >
            <input
              type="checkbox"
              checked={draft.marketing}
              onChange={(e) =>
                setDraft((d) => ({ ...d, marketing: e.target.checked }))
              }
              className="mt-0.5"
            />
            <div>
              <div className="text-sm font-medium">Marketing</div>
              <div className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                Third-party pixels for ad measurement.
              </div>
            </div>
          </label>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            className="btn-stripe btn-stripe-primary"
          >
            Save preferences
          </button>

          {saved && (
            <span
              className="text-sm"
              style={{ color: "var(--success)" }}
            >
              Saved.
            </span>
          )}
        </div>
      </section>
    </div>
  );
}