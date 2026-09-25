// app/dashboard/admin/page.tsx

import Link from "next/link";

export default function AdminOverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="eyebrow mb-1">Admin</div>
        <h1 className="page-title">Overview</h1>
        <p className="page-subtitle">
          Admin tools and management.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminCard
            href="/dashboard/admin/support"
            title="Support"
            description="Respond to user tickets and manage the support queue."
          />
          <AdminCard
            href="/dashboard/admin/plans"
            title="Plans"
            description="Create, edit, and deactivate subscription plans."
          />
          <AdminCard
            href="/dashboard/admin/users"
            title="Users"
            description="View and manage user accounts."
          />
          <AdminCard
            href="/dashboard/admin/payments"
            title="Payments"
            description="Monitor transactions and subscriptions."
          />
          <AdminCard
            href="/dashboard/admin/audit-log"
            title="Audit log"
            description="Review security events across all accounts."
          />
          <AdminCard
              href="/dashboard/admin/contact"
              title="Contact messages"
              description="Read and reply to messages from the public contact form."
            />
        </div>
    </div>
  );
}

function AdminCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="lp-lift block rounded-2xl border p-5"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
      }}
    >
      <div
        className="text-sm font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </div>
      <p
        className="mt-1 text-xs leading-5"
        style={{ color: "var(--text-muted)" }}
      >
        {description}
      </p>
    </Link>
  );
}