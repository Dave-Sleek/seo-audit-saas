// app/api/account/2fa/email/verify/route.ts

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import { users, twoFactorRecoveryCodes } from "@/app/db/schema";
import {
  logAuditEvent,
  getAuditIp,
  getAuditUserAgent,
} from "@/app/lib/audit-log";

const RECOVERY_CODE_COUNT = 10;

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

  /* ---------- Parse code ---------- */

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "Enter the 6-digit code we emailed you." },
      { status: 400 }
    );
  }

  /* ---------- Load fresh user ---------- */

  const [freshUser] = await db
    .select({
      id: users.id,
      twoFactorEmailCodeHash: users.twoFactorEmailCodeHash,
      twoFactorEmailCodeExpiresAt: users.twoFactorEmailCodeExpiresAt,
      twoFactorEnabledAt: users.twoFactorEnabledAt,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!freshUser?.twoFactorEmailCodeHash) {
    return NextResponse.json(
      { error: "No verification code was requested." },
      { status: 400 }
    );
  }

  if (freshUser.twoFactorEnabledAt) {
    return NextResponse.json(
      { error: "Two-factor authentication is already enabled." },
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

  /* ---------- Compare hash ---------- */

  if (hashCode(code) !== freshUser.twoFactorEmailCodeHash) {
    return NextResponse.json(
      { error: "Invalid code. Please try again." },
      { status: 400 }
    );
  }

  /* ---------- Generate recovery codes ---------- */

  const rawCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
    randomBytes(4).toString("hex").toUpperCase()
  );

  /* ---------- Enable 2FA + store recovery codes ---------- */

  await db.transaction(async (tx) => {
    await tx
      .delete(twoFactorRecoveryCodes)
      .where(eq(twoFactorRecoveryCodes.userId, user.id));

    await tx.insert(twoFactorRecoveryCodes).values(
      rawCodes.map((c) => ({
        userId: user.id,
        codeHash: hashCode(c),
      }))
    );

    /*
     * Enable email-based 2FA.
     *
     * - twoFactorMethod = "email" so the login route picks
     *   the email OTP path.
     * - twoFactorSecret = null to clear any stale TOTP secret
     *   from an abandoned enrollment. Otherwise the login
     *   route's fallback inference (secret present → totp)
     *   could pick TOTP even though the user chose email.
     * - Clear the email code hash and expiry; the code has
     *   just been consumed.
     */
    await tx
      .update(users)
      .set({
        twoFactorEnabledAt: new Date(),
        twoFactorMethod: "email",
        twoFactorSecret: null,
        twoFactorEmailCodeHash: null,
        twoFactorEmailCodeExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
  });

  /* ---------- Audit log ---------- */

  /*
   * Fire after the transaction commits. An audit entry is
   * a statement about what actually happened; if the DB
   * writes rolled back, we must not log a success.
   *
   * Severity is "info" — enabling 2FA strengthens the
   * account.
   */
  await logAuditEvent({
    userId: user.id,
    eventType: "auth.2fa.enabled",
    severity: "info",
    ipAddress: ip,
    userAgent,
    metadata: { method: "email" },
  });

  return NextResponse.json({
    success: true,
    recoveryCodes: rawCodes,
  });
}