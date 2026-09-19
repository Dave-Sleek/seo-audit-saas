import Link from "next/link";
import { redirect } from "next/navigation";

import { getAdminUser } from "@/app/lib/admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();

  if (!admin) {
    // Redirect non-admins to the dashboard (404 would be OK too if
    // you don't want to reveal the route exists)
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Admin sub-nav */}
      <div
        className="flex flex-wrap items-center gap-1 rounded-xl border p-1.5"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
        }}
      >
        <AdminNavLink href="/dashboard/admin">Overview</AdminNavLink>
        <AdminNavLink href="/dashboard/admin/plans">Plans</AdminNavLink>
        <AdminNavLink href="/dashboard/admin/users">Users</AdminNavLink>
        <AdminNavLink href="/dashboard/admin/payments">Payments</AdminNavLink>
      </div>

      {children}
    </div>
  );
}

function AdminNavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3.5 py-2 text-sm font-medium transition-colors hover:bg-slate-50"
      style={{ color: "var(--text-secondary)" }}
    >
      {children}
    </Link>
  );
}