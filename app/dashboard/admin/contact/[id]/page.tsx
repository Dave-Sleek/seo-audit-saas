// app/dashboard/admin/contact/[id]/page.tsx

import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { db } from "@/app/db";
import {
  contactMessageReplies,
  contactMessages,
  users,
} from "@/app/db/schema";
import ContactActions from "./contact-actions";
import ContactReplyForm from "./contact-reply-form";

export const dynamic = "force-dynamic";

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
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

export default async function AdminContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [message] = await db
    .select()
    .from(contactMessages)
    .where(eq(contactMessages.id, id))
    .limit(1);

  if (!message) {
    notFound();
  }

  /* ---------- Load replies ---------- */

  const replies = await db
    .select({
      id: contactMessageReplies.id,
      body: contactMessageReplies.body,
      authorRole: contactMessageReplies.authorRole,
      createdAt: contactMessageReplies.createdAt,
      author: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(contactMessageReplies)
    .leftJoin(users, eq(contactMessageReplies.authorId, users.id))
    .where(eq(contactMessageReplies.messageId, message.id))
    .orderBy(asc(contactMessageReplies.createdAt));

  const isClosed = message.status === "closed";
  const senderName = message.name?.trim() || message.email;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <nav className="breadcrumbs mb-3" aria-label="Breadcrumb">
            <Link href="/dashboard/admin">Admin</Link>
            <span className="breadcrumb-separator">/</span>
            <Link href="/dashboard/admin/contact">Contact</Link>
            <span className="breadcrumb-separator">/</span>
            <span className="truncate">
              {message.subject}
            </span>
          </nav>

          <div className="eyebrow mb-1">Contact message</div>
          <h1 className="page-title break-words">
            {message.subject}
          </h1>
          <p className="page-subtitle">
            From {senderName} · {formatDateTime(message.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start">
          <span className={statusBadgeClass(message.status)}>
            {message.status.charAt(0).toUpperCase() +
              message.status.slice(1)}
          </span>

          <Link
            href="/dashboard/admin/contact"
            className="btn-stripe btn-stripe-secondary"
          >
            All messages
          </Link>
        </div>
      </div>

      {/* Actions */}
      <ContactActions
        messageId={message.id}
        status={message.status}
      />

      {/* Original message */}
      <section className="stripe-panel">
        <div
          className="flex items-center gap-3 border-b px-6 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ background: "var(--text-muted)" }}
            aria-hidden="true"
          >
            {senderName.charAt(0).toUpperCase()}
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {senderName}
            </div>
            <div className="text-xs text-slate-500">
              {message.email}
              {message.userId && (
                <span className="ml-2 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px]">
                  Registered user
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {message.message}
          </p>
        </div>
      </section>

      {/* Reply thread */}
      {replies.length > 0 && (
        <section className="flex flex-col gap-3">
          {replies.map((reply) => {
            const replyName =
              reply.author?.name?.trim() ||
              reply.author?.email ||
              "Admin";

            return (
              <div
                key={reply.id}
                className="stripe-panel"
                style={{
                  borderColor: "var(--primary)",
                  background: "var(--primary-light)",
                }}
              >
                <div
                  className="flex items-center gap-3 border-b px-6 py-4"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: "var(--primary)" }}
                    aria-hidden="true"
                  >
                    {replyName.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {replyName}
                      </span>
                      <span className="stripe-badge stripe-badge-info">
                        Support team
                      </span>
                    </div>
                    <div
                      className="text-xs text-slate-500"
                      title={formatDateTime(reply.createdAt)}
                    >
                      {formatDateTime(reply.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="px-6 py-5">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {reply.body}
                  </p>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Reply form */}
      {isClosed ? (
        <section className="stripe-panel">
          <div className="px-6 py-6 text-center">
            <p className="text-sm text-slate-500">
              This message is closed. Reopen it from the action bar
              above to reply.
            </p>
          </div>
        </section>
      ) : (
        <section className="stripe-panel">
          <div className="px-6 py-6">
            <ContactReplyForm
              messageId={message.id}
              recipientEmail={message.email}
            />
          </div>
        </section>
      )}
    </div>
  );
}