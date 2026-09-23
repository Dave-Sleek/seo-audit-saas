import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { verify as verifyTotp } from "otplib";
import { randomBytes, createHash } from "crypto";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import { users, twoFactorRecoveryCodes } from "@/app/db/schema";
import { decrypt } from "@/app/lib/crypto";

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

  /* ---------- Parse code ---------- */

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "Enter the 6-digit code from your authenticator app." },
      { status: 400 }
    );
  }

  /* ---------- Reload user to get the freshly-stored secret ---------- */

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

  /* ---------- Verify the TOTP code ---------- */

  const secret = decrypt(freshUser.twoFactorSecret);

  /*
   * v13 API: verify() is async and returns { valid: boolean }.
   * epochTolerance is in seconds — 30 means ±30s of clock drift
   * (same as the old `window: 1` on a 30s step).
   */
  let valid = false;

  try {
    const result = await verifyTotp({
      secret,
      token: code,
      epochTolerance: 30,
    });
    valid = result.valid;
  } catch {
    // Malformed token (wrong length, non-numeric, etc.)
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
    // Wipe any old recovery codes (in case of re-enrollment).
    await tx
      .delete(twoFactorRecoveryCodes)
      .where(eq(twoFactorRecoveryCodes.userId, user.id));

    // Store hashes of the new codes.
    await tx.insert(twoFactorRecoveryCodes).values(
      rawCodes.map((c) => ({
        userId: user.id,
        codeHash: hashCode(c),
      }))
    );

    // Enable TOTP 2FA.
    //
    // - Keep twoFactorSecret (it's the secret they just verified).
    // - Set twoFactorMethod so the login route picks TOTP.
    // - Clear any leftover email code from a previous
    //   enrollment attempt so the login route doesn't get
    //   confused about which method is active.
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

  /* ---------- Return raw codes ONCE ---------- */

  return NextResponse.json({
    success: true,
    recoveryCodes: rawCodes,
  });
}