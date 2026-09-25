// app/api/contact/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/app/db";
import { contactMessages } from "@/app/db/schema";
import { getCurrentUser } from "@/app/lib/auth";
import {
  logAuditEvent,
  getAuditIp,
  getAuditUserAgent,
} from "@/app/lib/audit-log";

const createMessageSchema = z.object({
  name: z
    .string()
    .trim()
    .max(255, "Name is too long.")
    .optional()
    .or(z.literal("")),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(255, "Email is too long."),

  subject: z
    .string()
    .trim()
    .max(255, "Subject is too long.")
    .optional()
    .or(z.literal("")),

  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters.")
    .max(5000, "Message is too long."),
});

export async function POST(request: Request) {
  try {
    const ip = getAuditIp(request) ?? "unknown";
    const userAgent = getAuditUserAgent(request);

    /* ---------- Optional: attach to user if signed in ---------- */

    const user = await getCurrentUser();

    /* ---------- Parse + validate ---------- */

    const raw = await request.json().catch(() => null);
    const parsed = createMessageSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 }
      );
    }

    const {
      name,
      email,
      subject,
      message: body,
    } = parsed.data;

    /* ---------- Insert ---------- */

    const [inserted] = await db
      .insert(contactMessages)
      .values({
        userId: user?.id ?? null,
        name: name?.trim() || null,
        email,
        subject: subject?.trim() || null,
        message: body,
        status: "unread",
      })
      .returning();

    if (!inserted) {
      return NextResponse.json(
        { error: "Unable to submit message." },
        { status: 500 }
      );
    }

    /* ---------- Audit log ---------- */

    await logAuditEvent({
      userId: user?.id ?? null,
      eventType: "admin.action",
      severity: "info",
      ipAddress: ip,
      userAgent,
      metadata: {
        action: "contact.message_submitted",
        messageId: inserted.id,
        senderEmail: email,
      },
    });

    return NextResponse.json({
      success: true,
      message: {
        id: inserted.id,
        createdAt: inserted.createdAt,
      },
    });
  } catch (error) {
    console.error("Contact form error:", error);

    return NextResponse.json(
      { error: "Unable to submit message." },
      { status: 500 }
    );
  }
}