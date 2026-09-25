// app/api/admin/contact/[id]/replies/route.ts

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import {
  contactMessageReplies,
  contactMessages,
} from "@/app/db/schema";
import { sendContactReplyEmail } from "@/app/lib/email/send";
import {
  logAuditEvent,
  getAuditIp,
  getAuditUserAgent,
} from "@/app/lib/audit-log";

const replySchema = z.object({
  body: z
    .string()
    .trim()
    .min(2, "Reply is too short.")
    .max(5000, "Reply is too long."),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  if (user.role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden." },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  const [message] = await db
    .select()
    .from(contactMessages)
    .where(eq(contactMessages.id, id))
    .limit(1);

  if (!message) {
    return NextResponse.json(
      { error: "Message not found." },
      { status: 404 }
    );
  }

  if (message.status === "closed") {
    return NextResponse.json(
      { error: "This message is closed. Reopen it first." },
      { status: 400 }
    );
  }

  const raw = await request.json().catch(() => null);
  const parsed = replySchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  /* ---------- Insert reply + mark as replied ---------- */

  await db.transaction(async (tx) => {
    await tx.insert(contactMessageReplies).values({
      messageId: message.id,
      authorId: user.id,
      authorRole: "admin",
      body: parsed.data.body,
    });

    await tx
      .update(contactMessages)
      .set({ status: "replied" })
      .where(eq(contactMessages.id, message.id));
  });

  /* ---------- Audit log ---------- */

  await logAuditEvent({
    userId: message.userId,
    actorId: user.id,
    eventType: "admin.action",
    severity: "info",
    ipAddress: getAuditIp(request),
    userAgent: getAuditUserAgent(request),
    metadata: {
      action: "contact.message_replied",
      messageId: message.id,
      recipientEmail: message.email,
    },
  });

  /* ---------- Send email (fire-and-forget) ---------- */

  void sendContactReplyEmail({
    to: message.email,
    name: message.name,
    subject: message.subject ?? "(no subject)",  // 👈 only change
    originalMessage: message.message,
    replyBody: parsed.data.body,
    messageId: message.id,
  });

  return NextResponse.json({ success: true });
}