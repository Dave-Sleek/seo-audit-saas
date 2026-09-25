// app/api/support/tickets/[id]/status/route.ts

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import { supportTickets } from "@/app/db/schema";

const STATUSES = ["open", "pending", "resolved", "closed"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const patchSchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
  })
  .refine(
    (v) => v.status !== undefined || v.priority !== undefined,
    "Nothing to update."
  );

export async function PATCH(
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

  const raw = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const [existing] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json(
      { error: "Ticket not found." },
      { status: 404 }
    );
  }

  const now = new Date();

  const update: Record<string, unknown> = {
    updatedAt: now,
  };

  if (parsed.data.status !== undefined) {
    update.status = parsed.data.status;

    // Stamp resolvedAt the first time it moves into resolved.
    // Clear it when it leaves resolved.
    if (parsed.data.status === "resolved") {
      update.resolvedAt = existing.resolvedAt ?? now;
    } else if (existing.status === "resolved") {
      update.resolvedAt = null;
    }
  }

  if (parsed.data.priority !== undefined) {
    update.priority = parsed.data.priority;
  }

  await db
    .update(supportTickets)
    .set(update)
    .where(eq(supportTickets.id, id));

  return NextResponse.json({ success: true });
}