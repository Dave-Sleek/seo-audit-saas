// app/api/auth/verify-email/route.ts

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";

import { db } from "@/app/db";
import {
  users,
  emailVerificationTokens,
} from "@/app/db/schema";
import {
  logAuditEvent,
  getAuditIp,
  getAuditUserAgent,
} from "@/app/lib/audit-log";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const token =
    typeof body?.token === "string" ? body.token.trim() : "";

  if (!token) {
    return NextResponse.json(
      { error: "Missing verification token.", code: "MISSING" },
      { status: 400 }
    );
  }

  /* ---------- Audit context ---------- */

  const ip = getAuditIp(request) ?? "unknown";
  const userAgent = getAuditUserAgent(request);

  const now = new Date();
  const tokenHash = hashToken(token);

  /* ---------- Look up the token ---------- */

  const [row] = await db
    .select({
      id: emailVerificationTokens.id,
      userId: emailVerificationTokens.userId,
      expiresAt: emailVerificationTokens.expiresAt,
      usedAt: emailVerificationTokens.usedAt,
    })
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.tokenHash, tokenHash))
    .limit(1);

  if (!row) {
    return NextResponse.json(
      {
        error: "This verification link is invalid.",
        code: "INVALID",
      },
      { status: 400 }
    );
  }

  if (row.usedAt) {
    return NextResponse.json(
      {
        error: "This verification link has already been used.",
        code: "USED",
      },
      { status: 400 }
    );
  }

  if (row.expiresAt < now) {
    return NextResponse.json(
      {
        error:
          "This verification link has expired. Request a new one.",
        code: "EXPIRED",
      },
      { status: 400 }
    );
  }

  /* ---------- Mark the token used + the user verified ---------- */

  await db.transaction(async (tx) => {
    await tx
      .update(emailVerificationTokens)
      .set({ usedAt: now })
      .where(eq(emailVerificationTokens.id, row.id));

    await tx
      .update(users)
      .set({
        emailVerifiedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, row.userId));
  });

  /* ---------- Audit log ---------- */

  /*
   * Fire after the transaction commits. The audit entry
   * is a statement about what actually happened — if the
   * DB writes rolled back, we must not log a success.
   *
   * Severity is "info". Email verification is a normal
   * step in a new account's lifecycle, not a security
   * event.
   */
  await logAuditEvent({
    userId: row.userId,
    eventType: "auth.email_verified",
    severity: "info",
    ipAddress: ip,
    userAgent,
  });

  console.log("[verify-email] verified", { userId: row.userId });

  return NextResponse.json({ success: true });
}