// app/dashboard/admin/admin-nav-link.tsx

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminNavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Exact match for the overview so it doesn't stay active on
  // every /dashboard/admin/* page. Prefix match for everything
  // else so nested routes (e.g. /support/[id]) keep the tab lit.
  const isActive =
    href === "/dashboard/admin"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className="rounded-lg px-3.5 py-2 text-sm font-medium transition-colors hover:bg-slate-50"
      style={{
        color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
        background: isActive ? "var(--surface-hover, #f1f5f9)" : undefined,
      }}
    >
      {children}
    </Link>
  );
}