// app/api/account/2fa/disable/route.ts

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";

import { getCurrentUser, verifyPassword } from "@/app/lib/auth";
import { db } from "@/app/db";
import { users, twoFactorRecoveryCodes } from "@/app/db/schema";
import { createNotification } from "@/app/lib/notifications";
import {
  logAuditEvent,
  getAuditIp,
  getAuditUserAgent,
} from "@/app/lib/audit-log";

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function POST(request: Request) {
  /* ---------- Auth ---------- */

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  /* ---------- Audit context ---------- */

  const ip = getAuditIp(request) ?? "unknown";
  const userAgent = getAuditUserAgent(request);

  /* ---------- Parse body ---------- */

  const body = await request.json().catch(() => null);

  const password =
    typeof body?.password === "string" ? body.password : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!password || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "Password and 6-digit code are required." },
      { status: 400 }
    );
  }

  /* ---------- Load fresh user ---------- */

  const [freshUser] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      twoFactorEnabledAt: users.twoFactorEnabledAt,
      twoFactorMethod: users.twoFactorMethod,
      twoFactorSecret: users.twoFactorSecret,
      twoFactorEmailCodeHash: users.twoFactorEmailCodeHash,
      twoFactorEmailCodeExpiresAt: users.twoFactorEmailCodeExpiresAt,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!freshUser) {
    return NextResponse.json(
      { error: "User not found." },
      { status: 404 }
    );
  }

  if (!freshUser.twoFactorEnabledAt) {
    return NextResponse.json(
      { error: "Two-factor authentication is not enabled." },
      { status: 400 }
    );
  }

  /*
   * Capture the method now, before the transaction nulls
   * the column. The audit entry needs to record which
   * method was disabled.
   */
  const previousMethod =
    freshUser.twoFactorMethod ??
    (freshUser.twoFactorSecret ? "totp" : "email");

  /* ---------- Verify password ---------- */

  const passwordValid = await verifyPassword(
    password,
    freshUser.passwordHash
  );

  if (!passwordValid) {
    return NextResponse.json(
      { error: "Incorrect password." },
      { status: 401 }
    );
  }

  /* ---------- Verify the code ---------- */

  if (!freshUser.twoFactorEmailCodeHash) {
    return NextResponse.json(
      { error: "No verification code was requested." },
      { status: 400 }
    );
  }

  if (
    !freshUser.twoFactorEmailCodeExpiresAt ||
    freshUser.twoFactorEmailCodeExpiresAt < new Date()
  ) {
    return NextResponse.json(
      { error: "This code has expired. Request a new one." },
      { status: 400 }
    );
  }

  if (hashCode(code) !== freshUser.twoFactorEmailCodeHash) {
    return NextResponse.json(
      { error: "Invalid code." },
      { status: 401 }
    );
  }

  /* ---------- Disable 2FA in a transaction ---------- */

  await db.transaction(async (tx) => {
    await tx
      .delete(twoFactorRecoveryCodes)
      .where(eq(twoFactorRecoveryCodes.userId, user.id));

    await tx
      .update(users)
      .set({
        twoFactorEnabledAt: null,
        twoFactorMethod: null,
        twoFactorSecret: null,
        twoFactorEmailCodeHash: null,
        twoFactorEmailCodeExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
  });

  /* ---------- Audit log ---------- */

  /*
   * Fire after the transaction commits.
   *
   * Severity is "critical" — this is the single strongest
   * signal of account takeover. An attacker with a stolen
   * session who disables 2FA is doing it so they can log
   * in from their own device next time. Getting an alert
   * on this event catches the takeover within minutes
   * instead of weeks later when the real user can't log in.
   */
  await logAuditEvent({
    userId: user.id,
    eventType: "auth.2fa.disabled",
    severity: "critical",
    ipAddress: ip,
    userAgent,
    metadata: { method: previousMethod },
  });

  /* ---------- Notify: 2FA disabled ---------- */

  await createNotification({
    userId: user.id,
    type: "security.2fa_disabled",
    title: "Two-factor authentication disabled",
    body: "If you didn't do this, secure your account immediately.",
    actionUrl: "/dashboard/settings",
  });

  return NextResponse.json({ success: true });
}