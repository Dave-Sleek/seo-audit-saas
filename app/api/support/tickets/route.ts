// app/api/support/tickets/route.ts

import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import { supportTickets } from "@/app/db/schema";
import { generateTicketReference } from "@/app/lib/support";
import {
  logAuditEvent,
  getAuditIp,
  getAuditUserAgent,
} from "@/app/lib/audit-log";
import {
  sendTicketCreatedEmail,
  sendTicketAdminNotifyEmail,
} from "@/app/lib/email/send";
import { getSupportAdminEmails } from "@/app/lib/support-admins";

const createTicketSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(5, "Subject must be at least 5 characters.")
    .max(200, "Subject is too long."),
  category: z.enum(["bug", "billing", "feature", "other"]),
  body: z
    .string()
    .trim()
    .min(20, "Please describe the issue in at least 20 characters.")
    .max(5000, "Message is too long."),
});

/**
 * GET /api/support/tickets
 * List the current user's tickets.
 */
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const tickets = await db
    .select({
      id: supportTickets.id,
      reference: supportTickets.reference,
      subject: supportTickets.subject,
      category: supportTickets.category,
      status: supportTickets.status,
      priority: supportTickets.priority,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
      lastReplyAt: supportTickets.lastReplyAt,
    })
    .from(supportTickets)
    .where(eq(supportTickets.userId, user.id))
    .orderBy(desc(supportTickets.createdAt));

  return NextResponse.json({ success: true, tickets });
}

/**
 * POST /api/support/tickets
 * Create a new support ticket.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const ip = getAuditIp(request) ?? "unknown";
    const userAgent = getAuditUserAgent(request);

    const body = await request.json().catch(() => null);
    const parsed = createTicketSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 }
      );
    }

    const { subject, category, body: ticketBody } = parsed.data;

    const reference = generateTicketReference();

    const [ticket] = await db
      .insert(supportTickets)
      .values({
        userId: user.id,
        reference,
        subject,
        category,
        status: "open",
        priority: "normal",
        body: ticketBody,
      })
      .returning();

    if (!ticket) {
      return NextResponse.json(
        { error: "Unable to create ticket." },
        { status: 500 }
      );
    }

    await logAuditEvent({
      userId: user.id,
      eventType: "support.ticket.created",
      severity: "info",
      ipAddress: ip,
      userAgent,
      metadata: {
        ticketId: ticket.id,
        reference: ticket.reference,
        category: ticket.category,
      },
    });

    /* ---------------------------------------------------------
       Email notifications (fire-and-forget).
       `sendXEmail` already logs its own failures and returns a
       boolean — it never throws, so no extra try/catch needed.
    --------------------------------------------------------- */

    // 1) Confirmation to the user
    void sendTicketCreatedEmail({
      to: user.email,
      name: user.name,
      reference: ticket.reference,
      subject: ticket.subject,
      ticketId: ticket.id,
    });

    // 2) Notify admins
    void (async () => {
      try {
        const adminEmails = await getSupportAdminEmails();

        await Promise.all(
          adminEmails.map((email) =>
            sendTicketAdminNotifyEmail({
              to: email,
              reference: ticket.reference,
              subject: ticket.subject,
              category: ticket.category,
              priority: ticket.priority,
              body: ticket.body,
              userEmail: user.email,
              userName: user.name,
              ticketId: ticket.id,
            })
          )
        );
      } catch (err) {
        console.error("[email] admin recipient lookup failed", err);
      }
    })();

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id,
        reference: ticket.reference,
        subject: ticket.subject,
        category: ticket.category,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
    });
  } catch (error) {
    console.error("Support ticket creation error:", error);

    return NextResponse.json(
      { error: "Unable to create ticket." },
      { status: 500 }
    );
  }
}