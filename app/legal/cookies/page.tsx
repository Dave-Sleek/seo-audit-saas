import Link from "next/link";

/* =========================================================
   DATA
========================================================= */

/**
 * Keep this list in sync with the actual cookies the app sets.
 *
 * Search before adding or removing entries:
 *   grep -rn "cookies().set\|Set-Cookie\|document.cookie" app/
 *
 * If you add analytics, marketing pixels, or third-party
 * embeds, they must appear here AND be gated behind the
 * consent banner.
 */

type CookieEntry = {
  name: string;
  category: "essential" | "analytics" | "marketing";
  purpose: string;
  duration: string;
  provider: string;
};

const COOKIES: CookieEntry[] = [
  {
    name: "session",
    category: "essential",
    purpose:
      "Identifies your signed-in session. Required for authentication and account access.",
    duration: "30 days from sign-in",
    provider: "seo-audit-saas (first-party)",
  },
];

const CATEGORY_LABELS: Record<
  CookieEntry["category"],
  { label: string; description: string }
> = {
  essential: {
    label: "Strictly necessary",
    description:
      "Required for the app to function. These cannot be turned off. They never track you across other websites.",
  },
  analytics: {
    label: "Analytics",
    description:
      "Help us understand how the app is used so we can improve it. Data is aggregated and does not identify you personally.",
  },
  marketing: {
    label: "Marketing",
    description:
      "Used by third parties to measure advertising and show you relevant content elsewhere. You can opt out at any time.",
  },
};

/* =========================================================
   PAGE
========================================================= */

export const metadata = {
  title: "Cookie Policy",
  description:
    "Which cookies we use, why we use them, and how to control them.",
};

export default function CookiePolicyPage() {
  const byCategory = {
    essential: COOKIES.filter((c) => c.category === "essential"),
    analytics: COOKIES.filter((c) => c.category === "analytics"),
    marketing: COOKIES.filter((c) => c.category === "marketing"),
  };

  const lastUpdated = "September 23, 2026";

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <div className="eyebrow mb-1">Legal</div>
        <h1 className="page-title">Cookie Policy</h1>
        <p className="page-subtitle">
          Which cookies we use, why we use them, and how you can
          control them. Last updated {lastUpdated}.
        </p>
      </div>

      {/* Intro */}
      <section className="stripe-panel p-6">
        <div
          className="flex flex-col gap-3 text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          <p>
            Cookies are small text files that a website stores on your
            device. They are widely used to make websites work, to
            remember your preferences, and to provide information to
            the site owner.
          </p>
          <p>
            We use as few cookies as possible. The only cookies we set
            by default are those required to keep you signed in. Any
            optional category (analytics, marketing) is disabled until
            you explicitly turn it on.
          </p>
          <p>
            You can change your choices at any time on the{" "}
            <Link href="/dashboard/settings/cookies" className="stripe-link">
              cookie preferences
            </Link>{" "}
            page, or by clearing your browser data.
          </p>
        </div>
      </section>

      {/* Cookie categories */}
      {(["essential", "analytics", "marketing"] as const).map(
        (category) => {
          const entries = byCategory[category];
          const meta = CATEGORY_LABELS[category];
          const isEmpty = entries.length === 0;

          return (
            <section key={category} className="stripe-panel overflow-hidden">
              <header
                className="border-b px-6 py-5"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="section-title">{meta.label}</h2>
                  {category === "essential" && (
                    <span className="stripe-badge stripe-badge-neutral">
                      Always on
                    </span>
                  )}
                  {category !== "essential" && isEmpty && (
                    <span className="stripe-badge stripe-badge-neutral">
                      Not in use
                    </span>
                  )}
                  {category !== "essential" && !isEmpty && (
                    <span className="stripe-badge stripe-badge-info">
                      Opt-in
                    </span>
                  )}
                </div>
                <p
                  className="mt-2 max-w-3xl text-sm leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  {meta.description}
                </p>
              </header>

              <div className="p-6">
                {isEmpty ? (
                  <p
                    className="text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {category === "essential"
                      ? "No cookies in this category."
                      : "We do not currently set any cookies in this category. If we add them in the future, they will only run after you opt in."}
                  </p>
                ) : (
                  <div
                    className="stripe-table-wrapper"
                    style={{ border: 0, borderRadius: 0 }}
                  >
                    <table className="stripe-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Purpose</th>
                          <th>Duration</th>
                          <th>Provider</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((cookie) => (
                          <tr key={cookie.name}>
                            <td>
                              <span
                                className="font-mono text-xs"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {cookie.name}
                              </span>
                            </td>
                            <td>
                              <span
                                className="text-sm"
                                style={{ color: "var(--text-secondary)" }}
                              >
                                {cookie.purpose}
                              </span>
                            </td>
                            <td>
                              <span
                                className="text-xs"
                                style={{ color: "var(--text-secondary)" }}
                              >
                                {cookie.duration}
                              </span>
                            </td>
                            <td>
                              <span
                                className="text-xs"
                                style={{ color: "var(--text-muted)" }}
                              >
                                {cookie.provider}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          );
        }
      )}

      {/* Managing cookies */}
      <section className="stripe-panel p-6">
        <h2 className="section-title">Managing cookies</h2>

        <div
          className="mt-4 flex flex-col gap-4 text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          <div>
            <h3
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              In our app
            </h3>
            <p className="mt-1">
              Open the{" "}
              <Link
                href="/dashboard/settings/cookies"
                className="stripe-link"
              >
                cookie preferences
              </Link>{" "}
              page to turn analytics or marketing cookies on or off. Your
              choice takes effect immediately, without a page reload.
            </p>
          </div>

          <div>
            <h3
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              In your browser
            </h3>
            <p className="mt-1">
              Every major browser lets you view, block, and delete
              cookies. See your browser&apos;s help documentation:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>Chrome: Settings → Privacy and security → Cookies</li>
              <li>Firefox: Settings → Privacy &amp; Security → Cookies</li>
              <li>Safari: Preferences → Privacy → Cookies</li>
              <li>Edge: Settings → Cookies and site permissions</li>
            </ul>
            <p className="mt-2">
              Blocking our strictly necessary session cookie will sign
              you out and prevent the app from working.
            </p>
          </div>

          <div>
            <h3
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Do Not Track and Global Privacy Control
            </h3>
            <p className="mt-1">
              We honor the{" "}
              <abbr title="Global Privacy Control">GPC</abbr> signal
              sent by some browsers to treat your visit as an opt-out of
              optional cookies.
            </p>
          </div>
        </div>
      </section>

      {/* Legal basis */}
      <section className="stripe-panel p-6">
        <h2 className="section-title">Legal basis</h2>

        <div
          className="mt-4 flex flex-col gap-3 text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          <p>
            Strictly necessary cookies are set on the basis of our
            legitimate interest in operating a secure, functional
            service. They are exempt from prior consent under the
            ePrivacy Directive.
          </p>
          <p>
            All other cookies are set only after you give explicit
            consent, which you can withdraw at any time. Withdrawing
            consent does not affect the lawfulness of any processing
            that happened before you withdrew it.
          </p>
        </div>
      </section>

      {/* Contact */}
      <section className="stripe-panel p-6">
        <h2 className="section-title">Questions</h2>
        <p
          className="mt-3 text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          If you have questions about how we handle cookies or personal
          data, contact us at{" "}
          <a
            href="mailto:privacy@example.com"
            className="stripe-link"
          >
            privacy@example.com
          </a>
          . For more detail on what data we collect and why, see our{" "}
          <Link href="/legal/privacy" className="stripe-link">
            Privacy Policy
          </Link>
          .
        </p>
      </section>

      {/* Footer nav */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Link href="/legal/privacy" className="stripe-link">
          Privacy Policy
        </Link>
        <Link href="/legal/terms" className="stripe-link">
          Terms of Service
        </Link>
        <Link href="/dashboard/settings/cookies" className="stripe-link">
          Cookie preferences
        </Link>
      </div>
    </div>
  );
}