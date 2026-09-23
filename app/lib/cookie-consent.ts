/**
 * Cookie consent state.
 *
 * Stored in localStorage — NOT in a cookie — because writing
 * a consent cookie would itself require consent. localStorage
 * is client-only and never sent to the server.
 */

export const CONSENT_STORAGE_KEY = "cookie_consent_v1";
export const CONSENT_VERSION = 1;

export type ConsentCategories = {
  /** Always true — session, CSRF, and other functional cookies. */
  essential: true;
  /** Analytics and performance measurement. */
  analytics: boolean;
  /** Marketing, retargeting, third-party pixels. */
  marketing: boolean;
};

export type ConsentRecord = {
  version: number;
  decidedAt: string; // ISO timestamp
  categories: ConsentCategories;
};

export const DEFAULT_CONSENT: ConsentCategories = {
  essential: true,
  analytics: false,
  marketing: false,
};

/* =========================================================
   STORAGE
========================================================= */

export function readConsent(): ConsentRecord | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ConsentRecord;

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      parsed.version !== CONSENT_VERSION ||
      typeof parsed.categories !== "object"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeConsent(categories: ConsentCategories): ConsentRecord {
  const record: ConsentRecord = {
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
    categories: {
      essential: true,
      analytics: Boolean(categories.analytics),
      marketing: Boolean(categories.marketing),
    },
  };

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        CONSENT_STORAGE_KEY,
        JSON.stringify(record)
      );
    } catch {
      // localStorage may be disabled or full; silently ignore.
    }
  }

  return record;
}

export function clearConsent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/* =========================================================
   EVENTS
========================================================= */

/**
 * Custom event dispatched on window when consent changes.
 * Analytics loaders listen for this so they react to changes
 * made from any tab or the settings page.
 */
export const CONSENT_EVENT = "cookie-consent-changed";

export function dispatchConsentChange(record: ConsentRecord): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ConsentRecord>(CONSENT_EVENT, { detail: record })
  );
}