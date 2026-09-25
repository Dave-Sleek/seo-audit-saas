import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { verify as verifyTotp } from "otplib";
import { randomBytes, createHash } from "crypto";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import { users, twoFactorRecoveryCodes } from "@/app/db/schema";
import { decrypt } from "@/app/lib/crypto";
import { createNotification } from "@/app/lib/notifications";
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
      { error: "Enter the 6-digit code from your authenticator app." },
      { status: 400 }
    );
  }

  /* ---------- Reload user ---------- */

  const [freshUser] = await db
    .select({
      id: users.id,
      twoFactorSecret: users.twoFactorSecret,
      twoFactorEnabledAt: users.twoFactorEnabledAt,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!freshUser?.twoFactorSecret) {
    return NextResponse.json(
      { error: "Start the setup process first." },
      { status: 400 }
    );
  }

  if (freshUser.twoFactorEnabledAt) {
    return NextResponse.json(
      { error: "Two-factor authentication is already enabled." },
      { status: 400 }
    );
  }

  /* ---------- Verify TOTP ---------- */

  const secret = decrypt(freshUser.twoFactorSecret);

  let valid = false;

  try {
    const result = await verifyTotp({
      secret,
      token: code,
      epochTolerance: 30,
    });
    valid = result.valid;
  } catch {
    valid = false;
  }

  if (!valid) {
    return NextResponse.json(
      { error: "Invalid code. Please try again." },
      { status: 400 }
    );
  }

  /* ---------- Generate recovery codes ---------- */

  const rawCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
    randomBytes(4).toString("hex").toUpperCase()
  );

  /* ---------- Enable 2FA in a transaction ---------- */

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

    await tx
      .update(users)
      .set({
        twoFactorEnabledAt: new Date(),
        twoFactorMethod: "totp",
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
   * Severity is "info". Enabling 2FA strengthens the
   * account, so it's a normal, positive event.
   */
  await logAuditEvent({
    userId: user.id,
    eventType: "auth.2fa.enabled",
    severity: "info",
    ipAddress: ip,
    userAgent,
    metadata: { method: "totp" },
  });

  /* ---------- Notify: 2FA enabled ---------- */

  await createNotification({
    userId: user.id,
    type: "security.2fa_enabled",
    title: "Two-factor authentication enabled",
    body: "Your account now requires a code at sign-in.",
    actionUrl: "/dashboard/settings",
  });

  /* ---------- Return raw codes ONCE ---------- */

  return NextResponse.json({
    success: true,
    recoveryCodes: rawCodes,
  });
}