// app/dashboard/contact/page.tsx

import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, desc, eq, inArray } from "drizzle-orm";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import {
  contactMessageReplies,
  contactMessages,
} from "@/app/db/schema";

export const dynamic = "force-dynamic";

/* =========================================================
   HELPERS
========================================================= */

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
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

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "unread":
      return "stripe-badge stripe-badge-info";
    case "read":
      return "stripe-badge stripe-badge-neutral";
    case "replied":
      return "stripe-badge stripe-badge-success";
    case "closed":
      return "stripe-badge stripe-badge-neutral";
    default:
      return "stripe-badge stripe-badge-neutral";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "unread":
      return "Sent";
    case "read":
      return "Read by support";
    case "replied":
      return "Replied";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

/* =========================================================
   PAGE
========================================================= */

export default async function UserContactPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  /* ---------- Load the user's messages ---------- */

  const messages = await db
    .select()
    .from(contactMessages)
    .where(eq(contactMessages.userId, user.id))
    .orderBy(desc(contactMessages.createdAt));

  const messageIds = messages.map((m) => m.id);

  /* ---------- Load replies for those messages ---------- */

  type ReplyRow = {
    id: string;
    messageId: string;
    body: string;
    createdAt: Date;
  };

  let repliesByMessage: Record<string, ReplyRow[]> = {};

  if (messageIds.length > 0) {
    const rows = await db
      .select({
        id: contactMessageReplies.id,
        messageId: contactMessageReplies.messageId,
        body: contactMessageReplies.body,
        createdAt: contactMessageReplies.createdAt,
      })
      .from(contactMessageReplies)
      .where(inArray(contactMessageReplies.messageId, messageIds))
      .orderBy(asc(contactMessageReplies.createdAt));

    repliesByMessage = rows.reduce<Record<string, ReplyRow[]>>(
      (acc, row) => {
        const bucket =
          acc[row.messageId] ?? (acc[row.messageId] = []);
        bucket.push(row);
        return acc;
      },
      {}
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="eyebrow mb-1">Contact</div>
          <h1 className="page-title">Your messages</h1>
          <p className="page-subtitle">
            {messages.length === 0
              ? "Messages you send through the contact form appear here."
              : `${messages.length} message${
                  messages.length === 1 ? "" : "s"
                } sent.`}
          </p>
        </div>

        <Link
          href="/contact"
          className="btn-stripe btn-stripe-primary self-start"
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
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>New message</span>
        </Link>
      </div>

      {/* Empty state */}
      {messages.length === 0 ? (
        <section className="stripe-panel">
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div
              className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl"
              style={{
                background: "var(--surface-hover, #f1f5f9)",
                color: "var(--text-secondary)",
              }}
            >
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

            <h2 className="section-title mb-2">No messages yet</h2>

            <p
              className="mb-6 max-w-md text-sm leading-6"
              style={{ color: "var(--text-muted)" }}
            >
              Have a question, found a bug, or want to request a
              feature? Send us a message and it&apos;ll show up here.
            </p>

            <Link
              href="/contact"
              className="btn-stripe btn-stripe-primary"
            >
              Contact us
            </Link>
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-4">
          {messages.map((message) => {
            const replies = repliesByMessage[message.id] ?? [];

            return (
              <article
                key={message.id}
                className="stripe-panel overflow-hidden"
              >
                {/* Header */}
                <header
                  className="flex flex-col gap-3 border-b px-6 py-4 sm:flex-row sm:items-start sm:justify-between"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="min-w-0">
                    <h2
                      className="break-words text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {message.subject ?? "(no subject)"}
                    </h2>
                    <div
                      className="mt-1 text-xs"
                      style={{ color: "var(--text-muted)" }}
                      title={formatDateTime(message.createdAt)}
                    >
                      Sent {formatRelative(message.createdAt)}
                    </div>
                  </div>

                  <span className={statusBadgeClass(message.status)}>
                    {statusLabel(message.status)}
                  </span>
                </header>

                {/* Original message */}
                <div className="px-6 py-5">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {message.message}
                  </p>
                </div>

                {/* Replies */}
                {replies.length > 0 && (
                  <div
                    className="border-t px-6 py-5"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--primary-light, #eef2ff)",
                    }}
                  >
                    <div
                      className="mb-3 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {replies.length === 1
                        ? "1 reply from support"
                        : `${replies.length} replies from support`}
                    </div>

                    <div className="flex flex-col gap-3">
                      {replies.map((reply) => (
                        <div
                          key={reply.id}
                          className="rounded-lg border bg-white px-4 py-3"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <div
                            className="mb-1 flex items-center gap-2 text-xs"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <span className="font-semibold text-slate-700">
                              Support team
                            </span>
                            <span>·</span>
                            <span title={formatDateTime(reply.createdAt)}>
                              {formatRelative(reply.createdAt)}
                            </span>
                          </div>

                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                            {reply.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}