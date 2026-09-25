// app/dashboard/support/page.tsx

import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import { supportTickets } from "@/app/db/schema";

export const dynamic = "force-dynamic";

/* =========================================================
   HELPERS
========================================================= */

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "open":
      return "stripe-badge stripe-badge-info";
    case "pending":
      return "stripe-badge stripe-badge-warning";
    case "resolved":
      return "stripe-badge stripe-badge-success";
    case "closed":
      return "stripe-badge stripe-badge-neutral";
    default:
      return "stripe-badge stripe-badge-neutral";
  }
}

function categoryLabel(category: string): string {
  switch (category) {
    case "bug":
      return "Bug report";
    case "billing":
      return "Billing";
    case "feature":
      return "Feature request";
    default:
      return "Other";
  }
}

/* =========================================================
   PAGE
========================================================= */

export default async function SupportPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const tickets = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, user.id))
    .orderBy(desc(supportTickets.createdAt));

  const openCount = tickets.filter(
    (t) => t.status === "open" || t.status === "pending"
  ).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="eyebrow mb-1">Support</div>
          <h1 className="page-title">Support tickets</h1>
          <p className="page-subtitle">
            {tickets.length === 0
              ? "Get help from our team."
              : openCount > 0
                ? `${openCount} open ticket${openCount === 1 ? "" : "s"}.`
                : "All your tickets are resolved."}
          </p>
        </div>

        <Link
          href="/dashboard/support/new"
          className="btn-stripe btn-stripe-primary inline-flex items-center gap-2 self-start"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>New ticket</span>
        </Link>
      </div>

      {/* Empty state */}
      {tickets.length === 0 ? (
        <section className="stripe-panel">
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>

            <h2 className="section-title mb-2">No tickets yet</h2>
            <p
              className="mb-6 max-w-md text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              If you&apos;re stuck, found a bug, or have a question
              about billing, submit a ticket and we&apos;ll get back
              to you.
            </p>

            <Link
              href="/dashboard/support/new"
              className="btn-stripe btn-stripe-primary"
            >
              Submit a ticket
            </Link>
          </div>
        </section>
      ) : (
        <section className="stripe-panel overflow-hidden">
          <div className="stripe-table-wrapper" style={{ border: 0, borderRadius: 0 }}>
            <table className="stripe-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Subject</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Last update</th>
                  <th style={{ textAlign: "right" }} aria-label="Actions" />
                </tr>
              </thead>

              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <span
                        className="font-mono text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {ticket.reference}
                      </span>
                    </td>

                    <td>
                      <div
                        className="text-sm font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {ticket.subject}
                      </div>
                    </td>

                    <td>
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {categoryLabel(ticket.category)}
                      </span>
                    </td>

                    <td>
                      <span className={statusBadgeClass(ticket.status)}>
                        {ticket.status.charAt(0).toUpperCase() +
                          ticket.status.slice(1)}
                      </span>
                    </td>

                    <td>
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                        title={formatDate(
                          ticket.lastReplyAt ?? ticket.updatedAt
                        )}
                      >
                        {formatRelative(
                          ticket.lastReplyAt ?? ticket.updatedAt
                        )}
                      </span>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <Link
                        href={`/dashboard/support/${ticket.id}`}
                        className="btn-stripe btn-stripe-secondary"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}