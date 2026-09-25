// app/api/support/tickets/[id]/replies/route.ts

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import {
  supportTickets,
  supportTicketReplies,
} from "@/app/db/schema";

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

  const { id } = await context.params;

  /* ---------- Verify ownership ---------- */

  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.id, id),
        eq(supportTickets.userId, user.id)
      )
    )
    .limit(1);

  if (!ticket) {
    return NextResponse.json(
      { error: "Ticket not found." },
      { status: 404 }
    );
  }

  if (ticket.status === "closed") {
    return NextResponse.json(
      { error: "This ticket is closed." },
      { status: 400 }
    );
  }

  /* ---------- Validate ---------- */

  const body = await request.json().catch(() => null);
  const parsed = replySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  /* ---------- Insert reply + bump ticket ---------- */

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(supportTicketReplies).values({
      ticketId: ticket.id,
      authorId: user.id,
      authorRole: "user",
      body: parsed.data.body,
    });

    /*
     * A user reply bumps the status back to "open" if it was
     * "pending" (waiting on the user). Resolved stays resolved
     * until the user replies, at which point it's effectively
     * reopened.
     */
    await tx
      .update(supportTickets)
      .set({
        status:
          ticket.status === "resolved" || ticket.status === "pending"
            ? "open"
            : ticket.status,
        lastReplyAt: now,
        updatedAt: now,
      })
      .where(eq(supportTickets.id, ticket.id));
  });

  return NextResponse.json({ success: true });
}