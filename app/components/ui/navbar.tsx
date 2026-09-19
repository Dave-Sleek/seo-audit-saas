"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/* =========================================================
   NAV LINK
========================================================= */

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className="group relative text-sm font-medium transition-colors"
      style={{
        color: isActive ? "var(--text-primary)" : "var(--text-muted)",
      }}
    >
      {children}

      <span
        className="absolute -bottom-1 left-0 h-[2px] rounded-full transition-all duration-300 ease-out"
        style={{
          width: isActive ? "100%" : "0%",
          background: "var(--primary)",
        }}
      />

      {!isActive && (
        <span
          className="absolute -bottom-1 left-0 h-[2px] w-0 rounded-full transition-all duration-300 ease-out group-hover:w-full"
          style={{ background: "var(--text-subtle)" }}
        />
      )}
    </Link>
  );
}

/* =========================================================
   MOBILE NAV LINK
========================================================= */

function MobileNavLink({
  href,
  onClick,
  children,
  delayMs,
  open,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
  delayMs: number;
  open: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block rounded-lg px-3 py-3 text-sm font-medium transition-all duration-200"
      style={{
        color: "var(--text-secondary)",
        opacity: open ? 1 : 0,
        transform: open ? "translateY(0)" : "translateY(-6px)",
        transitionDelay: open ? `${delayMs}ms` : "0ms",
      }}
    >
      {children}
    </Link>
  );
}

/* =========================================================
   NAVBAR
========================================================= */

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  /* ---------- Scroll listener ---------- */

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ---------- Close on escape ---------- */

  useEffect(() => {
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  return (
    <header
      className="sticky top-0 z-50 border-b transition-all duration-300"
      style={{
        background: scrolled
          ? "rgba(255, 255, 255, 0.85)"
          : "rgba(255, 255, 255, 0.98)",
        borderColor: scrolled ? "var(--border)" : "transparent",
        backdropFilter: "saturate(180%) blur(12px)",
        WebkitBackdropFilter: "saturate(180%) blur(12px)",
        boxShadow: scrolled
          ? "0 1px 0 0 rgba(15, 23, 42, 0.04), 0 4px 12px -4px rgba(15, 23, 42, 0.08)"
          : "none",
      }}
    >
      <div
        className="mx-auto flex max-w-7xl items-center justify-between px-4 transition-all duration-300 sm:px-6 lg:px-8"
        style={{ height: scrolled ? 56 : 64 }}
      >
        {/* ---------- Logo ---------- */}
        <Link
          href="/"
          className="group flex items-center gap-2"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white transition-all duration-300 group-hover:rotate-[8deg] group-hover:scale-105"
            style={{
              background:
                "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
            }}
          >
            N
          </div>

          <span
            className="text-xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            NARA
            <span style={{ color: "var(--primary)" }}>NIO</span>
          </span>
        </Link>

        {/* ---------- Desktop nav ---------- */}
        <nav className="hidden items-center gap-8 md:flex">
          <NavLink href="/">Home</NavLink>
          <NavLink href="/pricing">Pricing</NavLink>
          <NavLink href="/contact">Contact</NavLink>
        </nav>

        {/* ---------- Desktop actions ---------- */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-semibold transition"
            style={{ color: "var(--text-secondary)" }}
          >
            Log in
          </Link>

          <Link href="/register" className="btn-stripe btn-stripe-primary">
            Get Started
          </Link>
        </div>

        {/* ---------- Mobile hamburger ---------- */}
        <button
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(!mobileOpen)}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border transition hover:bg-slate-50 md:hidden"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          <span className="sr-only">Toggle menu</span>

          <span
            className="pointer-events-none absolute h-[2px] w-5 rounded-full transition-all duration-300"
            style={{
              background: "currentColor",
              transform: mobileOpen
                ? "translateY(0) rotate(45deg)"
                : "translateY(-6px)",
            }}
          />

          <span
            className="pointer-events-none absolute h-[2px] w-5 rounded-full transition-all duration-300"
            style={{
              background: "currentColor",
              transform: mobileOpen ? "scaleX(0)" : "scaleX(1)",
              opacity: mobileOpen ? 0 : 1,
            }}
          />

          <span
            className="pointer-events-none absolute h-[2px] w-5 rounded-full transition-all duration-300"
            style={{
              background: "currentColor",
              transform: mobileOpen
                ? "translateY(0) rotate(-45deg)"
                : "translateY(6px)",
            }}
          />
        </button>
      </div>

      {/* ---------- Mobile menu ---------- */}
      <div
        className="grid overflow-hidden border-t transition-[grid-template-rows] duration-300 ease-out md:hidden"
        style={{
          gridTemplateRows: mobileOpen ? "1fr" : "0fr",
          borderTopColor: mobileOpen ? "var(--border)" : "transparent",
          background: "rgba(255, 255, 255, 0.98)",
        }}
      >
        <div className="min-h-0">
          <nav className="mx-auto max-w-7xl space-y-1 px-4 py-4">
            <MobileNavLink
              href="/"
              onClick={() => setMobileOpen(false)}
              delayMs={60}
              open={mobileOpen}
            >
              Home
            </MobileNavLink>

            <MobileNavLink
              href="/pricing"
              onClick={() => setMobileOpen(false)}
              delayMs={100}
              open={mobileOpen}
            >
              Pricing
            </MobileNavLink>

            <MobileNavLink
              href="/contact"
              onClick={() => setMobileOpen(false)}
              delayMs={140}
              open={mobileOpen}
            >
              Contact
            </MobileNavLink>

            <div
              className="mt-3 border-t pt-3"
              style={{
                borderColor: "var(--border-light)",
                opacity: mobileOpen ? 1 : 0,
                transform: mobileOpen ? "translateY(0)" : "translateY(-6px)",
                transition: "opacity 250ms ease 180ms, transform 250ms ease 180ms",
              }}
            >
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-3 text-sm font-semibold transition hover:bg-slate-50"
                style={{ color: "var(--text-secondary)" }}
              >
                Log in
              </Link>

              <div className="mt-2 px-3">
                <Link
                  href="/register"
                  onClick={() => setMobileOpen(false)}
                  className="btn-stripe btn-stripe-primary w-full justify-center"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}