"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function StickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      const scrolled = window.scrollY;
      const total =
        document.documentElement.scrollHeight - window.innerHeight;

      // Show after 25% scroll, hide near the very bottom
      const progress = total > 0 ? scrolled / total : 0;
      setVisible(progress > 0.25 && progress < 0.92);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 transition-all duration-300"
      style={{
        transform: visible ? "translateY(0)" : "translateY(120%)",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}
      aria-hidden={!visible}
    >
      <div
        className="flex w-full max-w-2xl items-center justify-between gap-4 rounded-2xl border bg-white/95 px-4 py-3 shadow-2xl backdrop-blur-md"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="min-w-0">
          <div
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Ready to see your SEO score?
          </div>
          <div
            className="hidden text-xs sm:block"
            style={{ color: "var(--text-muted)" }}
          >
            Free first audit — no signup required.
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <a
            href="#run-audit"
            className="hidden rounded-lg px-3 py-2 text-xs font-semibold sm:inline-flex"
            style={{ color: "var(--text-secondary)" }}
          >
            Try free
          </a>

          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-all duration-300 hover:shadow-lg"
            style={{ background: "var(--primary)" }}
          >
            Get started
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}