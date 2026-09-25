// app/dashboard/admin/layout.tsx

import { redirect } from "next/navigation";

import { getAdminUser } from "@/app/lib/admin";
import AdminNavLink from "./admin-nav-link";

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
        <AdminNavLink href="/dashboard/admin/audit-log">Audit log</AdminNavLink>
        <AdminNavLink href="/dashboard/admin/support">Support</AdminNavLink>
        <AdminNavLink href="/dashboard/admin/contact">Contact Messages</AdminNavLink>
      </div>

      {children}
    </div>
  );
}