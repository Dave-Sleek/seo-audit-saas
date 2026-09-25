// app/api/admin/contact/[id]/status/route.ts

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import { contactMessages } from "@/app/db/schema";
import {
  logAuditEvent,
  getAuditIp,
  getAuditUserAgent,
} from "@/app/lib/audit-log";

const STATUSES = ["unread", "read", "replied", "closed"] as const;

const patchSchema = z.object({
  status: z.enum(STATUSES),
});

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
    .from(contactMessages)
    .where(eq(contactMessages.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json(
      { error: "Message not found." },
      { status: 404 }
    );
  }

  await db
    .update(contactMessages)
    .set({ status: parsed.data.status })
    .where(eq(contactMessages.id, id));

  await logAuditEvent({
    userId: existing.userId,
    actorId: user.id,
    eventType: "admin.action",
    severity: "info",
    ipAddress: getAuditIp(request),
    userAgent: getAuditUserAgent(request),
    metadata: {
      action: "contact.message_status_changed",
      messageId: existing.id,
      fromStatus: existing.status,
      toStatus: parsed.data.status,
    },
  });

  return NextResponse.json({ success: true });
}