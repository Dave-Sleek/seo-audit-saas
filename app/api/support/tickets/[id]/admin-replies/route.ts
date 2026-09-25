// app/api/support/tickets/[id]/admin-replies/route.ts

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import {
  supportTickets,
  supportTicketReplies,
  users,
} from "@/app/db/schema";
import {
  logAuditEvent,
  getAuditIp,
  getAuditUserAgent,
} from "@/app/lib/audit-log";
import { sendTicketReplyEmail } from "@/app/lib/email/send";

const replySchema = z.object({
  body: z
    .string()
    .trim()
    .min(2, "Reply is too short.")
    .max(5000, "Reply is too long."),
  markPending: z.boolean().optional(),
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

  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, id))
    .limit(1);

  if (!ticket) {
    return NextResponse.json(
      { error: "Ticket not found." },
      { status: 404 }
    );
  }

  if (ticket.status === "closed") {
    return NextResponse.json(
      { error: "This ticket is closed. Reopen it first." },
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

  const now = new Date();
  const shouldMarkPending = parsed.data.markPending === true;
  const nextStatus = shouldMarkPending ? "pending" : "open";

  await db.transaction(async (tx) => {
    await tx.insert(supportTicketReplies).values({
      ticketId: ticket.id,
      authorId: user.id,
      authorRole: "admin",
      body: parsed.data.body,
    });

    await tx
      .update(supportTickets)
      .set({
        status: nextStatus,
        lastReplyAt: now,
        updatedAt: now,
      })
      .where(eq(supportTickets.id, ticket.id));
  });

  /* ---------------------------------------------------------
     Audit log
  --------------------------------------------------------- */

  await logAuditEvent({
    userId: ticket.userId,
    actorId: user.id,
    eventType: "support.ticket.admin_replied",
    severity: "info",
    ipAddress: getAuditIp(request),
    userAgent: getAuditUserAgent(request),
    metadata: {
      ticketId: ticket.id,
      reference: ticket.reference,
      newStatus: nextStatus,
    },
  });

  /* ---------------------------------------------------------
     Email notification to the customer (fire-and-forget).
     `sendTicketReplyEmail` swallows and logs its own errors.
  --------------------------------------------------------- */

  void (async () => {
    try {
      const [ticketUser] = await db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, ticket.userId))
        .limit(1);

      if (!ticketUser) return;

      await sendTicketReplyEmail({
        to: ticketUser.email,
        name: ticketUser.name,
        reference: ticket.reference,
        subject: ticket.subject,
        replyBody: parsed.data.body,
        ticketId: ticket.id,
        newStatus: nextStatus,
      });
    } catch (err) {
      console.error("[email] ticket-reply recipient lookup failed", err);
    }
  })();

  return NextResponse.json({ success: true });
}