import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, desc, eq } from "drizzle-orm";

import { db } from "@/app/db";
import {
  users,
  subscriptions,
  plans,
  projects,
  audits,
  payments,
} from "@/app/db/schema";

import UserEditForm from "./user-edit-form";

/* =========================================================
   HELPERS
========================================================= */

function formatDate(date: Date | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* =========================================================
   PAGE
========================================================= */

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  /* ---------- User ---------- */

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) {
    notFound();
  }

  /* ---------- Subscription ---------- */

  const [subscription] = await db
    .select({
      subscription: subscriptions,
      planName: plans.name,
    })
    .from(subscriptions)
    .leftJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.userId, id))
    .orderBy(desc(subscriptions.startsAt))
    .limit(1);

  /* ---------- Counts (parallel) ---------- */

  const [projectCountRow] = await db
    .select({ value: count() })
    .from(projects)
    .where(eq(projects.userId, id));

  const [auditCountRow] = await db
    .select({ value: count() })
    .from(audits)
    .innerJoin(projects, eq(audits.projectId, projects.id))
    .where(eq(projects.userId, id));

  const [paymentCountRow] = await db
    .select({ value: count() })
    .from(payments)
    .where(eq(payments.userId, id));

  const [successfulCountRow] = await db
    .select({ value: count() })
    .from(payments)
    .where(and(eq(payments.userId, id), eq(payments.status, "success")));

  const projectsTotal = Number(projectCountRow?.value ?? 0);
  const auditsTotal = Number(auditCountRow?.value ?? 0);
  const paymentsTotal = Number(paymentCountRow?.value ?? 0);
  const successfulTotal = Number(successfulCountRow?.value ?? 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Back */}
      <Link
        href="/dashboard/admin/users"
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-slate-900"
        style={{ color: "var(--text-muted)" }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to users
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold"
            style={{
              background:
                "linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)",
              color: "#c2410c",
            }}
          >
            {user.name.charAt(0).toUpperCase()}
          </span>

          <div>
            <div className="eyebrow mb-1">User</div>
            <h1 className="page-title">{user.name}</h1>
            <p className="page-subtitle">{user.email}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={`stripe-badge ${
              user.role === "admin"
                ? "stripe-badge-info"
                : "stripe-badge-neutral"
            }`}
          >
            {user.role}
          </span>

          {user.emailVerifiedAt ? (
            <span className="stripe-badge stripe-badge-success">
              Verified
            </span>
          ) : (
            <span className="stripe-badge stripe-badge-warning">
              Unverified
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Projects" value={projectsTotal} />
        <StatCard label="Audits" value={auditsTotal} />
        <StatCard label="Payments" value={paymentsTotal} />
        <StatCard
          label="Successful"
          value={successfulTotal}
          tone="success"
        />
      </div>

      {/* Subscription */}
      <section className="stripe-panel">
        <header
          className="border-b px-6 py-5"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="section-title">Subscription</h2>
          <p className="section-description">
            Most recent subscription for this user.
          </p>
        </header>

        <div className="px-6 py-6">
          {subscription ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCell
                label="Plan"
                value={subscription.planName ?? "Unknown"}
              />
              <StatCell
                label="Status"
                value={subscription.subscription.status}
              />
              <StatCell
                label="Started"
                value={formatDate(subscription.subscription.startsAt)}
              />
              <StatCell
                label="Ends"
                value={formatDate(subscription.subscription.endsAt)}
              />
            </div>
          ) : (
            <p
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              No subscription on file.
            </p>
          )}
        </div>
      </section>

      {/* Edit form */}
      <UserEditForm
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          emailVerifiedAt: user.emailVerifiedAt
            ? user.emailVerifiedAt.toISOString()
            : null,
        }}
      />
    </div>
  );
}

/* =========================================================
   SUB-COMPONENTS
========================================================= */

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success";
}) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div
        className="metric-value"
        style={
          tone === "success"
            ? { color: "var(--success)" }
            : undefined
        }
      >
        {value}
      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="metric-label">{label}</div>
      <div
        className="mt-1 text-sm font-semibold capitalize"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}