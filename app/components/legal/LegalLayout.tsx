import Link from "next/link";
import { ReactNode } from "react";

import Navbar from "@/app/components/ui/navbar";
import Footer from "@/app/components/ui/footer";

type Props = {
  eyebrow: string;
  title: string;
  lastUpdated: string;
  children: ReactNode;
};

export default function LegalLayout({
  eyebrow,
  title,
  lastUpdated,
  children,
}: Props) {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      <Navbar />

      <main>
        {/* Header */}
        <section
          className="border-b px-4 py-14 sm:px-6 sm:py-16 lg:px-8"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          <div className="mx-auto max-w-3xl">
            <p className="eyebrow" style={{ color: "var(--primary)" }}>
              {eyebrow}
            </p>

            <h1
              className="mt-3 text-3xl font-bold tracking-[-0.02em] sm:text-4xl"
              style={{ color: "var(--text-primary)" }}
            >
              {title}
            </h1>

            <p
              className="mt-3 text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Last updated: {lastUpdated}
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <article className="legal-prose">{children}</article>

            {/* Footer help line */}
            <div
              className="mt-16 rounded-2xl border p-6"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
              }}
            >
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Have questions?
              </p>
              <p
                className="mt-1 text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Contact us at{" "}
                <a
                  href="mailto:legal@[yourdomain].com"
                  className="stripe-link"
                >
                  legal@[yourdomain].com
                </a>{" "}
                and we&apos;ll respond within a few business days.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/privacy"
                  className="btn-stripe btn-stripe-secondary"
                >
                  Privacy Policy
                </Link>
                <Link
                  href="/terms"
                  className="btn-stripe btn-stripe-secondary"
                >
                  Terms of Service
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}