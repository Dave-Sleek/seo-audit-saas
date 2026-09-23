// app/api/auth/verify-2fa/route.ts

import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { verify as verifyTotp } from "otplib";
import { createHash } from "crypto";

import { db } from "@/app/db";
import { users, twoFactorRecoveryCodes } from "@/app/db/schema";
import { decrypt } from "@/app/lib/crypto";
import {
  consumeTwoFactorChallenge,
  createSession,
} from "@/app/lib/auth";

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function POST(request: Request) {
  /* ---------- Parse body ---------- */

  const body = await request.json().catch(() => null);

  const challengeToken =
    typeof body?.challengeToken === "string" ? body.challengeToken : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!challengeToken || !code) {
    return NextResponse.json(
      { error: "Missing challenge or code." },
      { status: 400 }
    );
  }

  /* ---------- Consume the challenge token ---------- */

  const userId = consumeTwoFactorChallenge(challengeToken);

  if (!userId) {
    return NextResponse.json(
      { error: "This challenge has expired. Please log in again." },
      { status: 401 }
    );
  }

  /* ---------- Load user ---------- */

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return NextResponse.json(
      { error: "Account not found." },
      { status: 400 }
    );
  }

  /* =========================================================
     PATH A — EMAIL OTP
  ========================================================= */

  if (user.twoFactorEmailCodeHash && user.twoFactorEmailCodeExpiresAt) {
    // Check expiry
    if (user.twoFactorEmailCodeExpiresAt < new Date()) {
      return NextResponse.json(
        { error: "This code has expired. Please sign in again." },
        { status: 400 }
      );
    }

    // Compare hashes
    const submittedHash = hashCode(code);

    if (submittedHash !== user.twoFactorEmailCodeHash) {
      return NextResponse.json(
        { error: "Invalid code." },
        { status: 401 }
      );
    }

    // Success — clear the code so it can't be reused
    await db
      .update(users)
      .set({
        twoFactorEmailCodeHash: null,
        twoFactorEmailCodeExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await createSession(user.id);

    return NextResponse.json({ success: true, method: "email" });
  }

  /* =========================================================
     PATH B — TOTP (authenticator app) + recovery codes
  ========================================================= */

  if (user.twoFactorSecret) {
    const secret = decrypt(user.twoFactorSecret);

    /*
     * v13 API: verify() is async and returns { valid: boolean }.
     * `epochTolerance` is in seconds — 30 means accept codes
     * from the previous, current, and next 30-second window
     * (i.e. ±1 window of clock drift).
     */
    let totpValid = false;

    try {
      const result = await verifyTotp({
        secret,
        token: code,
        epochTolerance: 30,
      });
      totpValid = result.valid;
    } catch {
      // Malformed token (e.g. wrong length) — treat as invalid
      totpValid = false;
    }

    if (totpValid) {
      await createSession(user.id);
      return NextResponse.json({ success: true, method: "totp" });
    }

    // Try recovery codes (8 hex chars, formatting stripped)
    const normalized = code.replace(/[^A-F0-9]/gi, "").toUpperCase();

    if (normalized.length === 8) {
      const [recoveryCode] = await db
        .select()
        .from(twoFactorRecoveryCodes)
        .where(
          and(
            eq(twoFactorRecoveryCodes.userId, user.id),
            eq(twoFactorRecoveryCodes.codeHash, hashCode(normalized)),
            isNull(twoFactorRecoveryCodes.usedAt)
          )
        )
        .limit(1);

      if (recoveryCode) {
        await db
          .update(twoFactorRecoveryCodes)
          .set({ usedAt: new Date() })
          .where(eq(twoFactorRecoveryCodes.id, recoveryCode.id));

        await createSession(user.id);

        return NextResponse.json({
          success: true,
          method: "recovery_code",
        });
      }
    }
  }

  /* =========================================================
     NO METHOD MATCHED — REJECT
  ========================================================= */

  return NextResponse.json(
    { error: "Invalid code." },
    { status: 401 }
  );
}