import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/app/db";
import { users } from "@/app/db/schema";
import { getCurrentUser } from "@/app/lib/auth";
import {
  logAuditEvent,
  getAuditIp,
  getAuditUserAgent,
} from "@/app/lib/audit-log";

/* =========================================================
   VALIDATION
========================================================= */

const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(80, "Name is too long."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address."),
});

/* =========================================================
   PATCH /api/account/profile
========================================================= */

export async function PATCH(request: NextRequest) {
  try {
    /* ---------- AUTH ---------- */
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    /* ---------- AUDIT CONTEXT ---------- */
    const ip = getAuditIp(request) ?? "unknown";
    const userAgent = getAuditUserAgent(request);

    /* ---------- VALIDATE ---------- */
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 }
      );
    }

    const { name, email } = parsed.data;

    /* ---------- COMPUTE CHANGES ---------- */
    /*
     * Build the list of fields that actually changed. If the
     * user submits the same values, we skip the DB write and
     * the audit entry entirely.
     */
    const changedFields: string[] = [];

    if (name !== user.name) changedFields.push("name");
    if (email !== user.email) changedFields.push("email");

    if (changedFields.length === 0) {
      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      });
    }

    /* ---------- EMAIL UNIQUENESS ---------- */
    if (email !== user.email) {
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existing.length > 0) {
        return NextResponse.json(
          { error: "That email is already in use." },
          { status: 409 }
        );
      }
    }

    /* ---------- UPDATE ---------- */
    const [updated] = await db
      .update(users)
      .set({ name, email })
      .where(eq(users.id, user.id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
      });

    if (!updated) {
      return NextResponse.json(
        { error: "Unable to update profile." },
        { status: 500 }
      );
    }

    /* ---------- AUDIT LOG ---------- */
    /*
     * Fire after the DB write. If the update rolled back, we
     * must not log a change that didn't happen.
     *
     * Email changes are logged at "warning" severity, name-only
     * changes at "info". Changing the email address is a
     * precursor to account takeover — the attacker
     * redirects password-reset emails to an inbox they
     * control. Name changes are cosmetic.
     */
    const emailChanged = changedFields.includes("email");

    await logAuditEvent({
      userId: user.id,
      eventType: "account.profile_updated",
      severity: emailChanged ? "warning" : "info",
      ipAddress: ip,
      userAgent,
      metadata: {
        changedFields,
        previousName: user.name,
        previousEmail: user.email,
        newName: updated.name,
        newEmail: updated.email,
      },
    });

    return NextResponse.json({
      success: true,
      user: updated,
    });
  } catch (error) {
    console.error("Profile update error:", error);

    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}