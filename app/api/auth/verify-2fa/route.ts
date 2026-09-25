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
import {
  logAuditEvent,
  getAuditIp,
  getAuditUserAgent,
} from "@/app/lib/audit-log";

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

/* =========================================================
   ATTEMPT TRACKING
========================================================= */

/*
 * Max number of wrong codes allowed per challenge token
 * before the challenge is invalidated entirely.
 *
 * 5 gives a legitimate user room for a typo and a clock-drift
 * retry. It gives an attacker a 5-in-1,000,000 chance of
 * landing the correct code, which is effectively zero.
 */
const MAX_ATTEMPTS_PER_CHALLENGE = 5;

type AttemptState = {
  attempts: number;
  expiresAt: number;
};

const attemptTracker = new Map<string, AttemptState>();

const ATTEMPT_TTL_MS = 10 * 60 * 1000;

function getAttempts(token: string): number {
  const state = attemptTracker.get(token);

  if (!state) return 0;

  if (state.expiresAt < Date.now()) {
    attemptTracker.delete(token);
    return 0;
  }

  return state.attempts;
}

function recordAttempt(token: string): void {
  const now = Date.now();
  const existing = attemptTracker.get(token);

  if (!existing || existing.expiresAt < now) {
    attemptTracker.set(token, {
      attempts: 1,
      expiresAt: now + ATTEMPT_TTL_MS,
    });
    return;
  }

  existing.attempts += 1;
}

function clearAttempts(token: string): void {
  attemptTracker.delete(token);
}

/* Periodic cleanup. */
if (typeof globalThis !== "undefined") {
  const g = globalThis as typeof globalThis & {
    __attemptTrackerCleanup?: NodeJS.Timeout;
  };

  if (!g.__attemptTrackerCleanup) {
    g.__attemptTrackerCleanup = setInterval(
      () => {
        const now = Date.now();
        for (const [token, state] of attemptTracker) {
          if (state.expiresAt < now) {
            attemptTracker.delete(token);
          }
        }
      },
      10 * 60 * 1000
    );

    g.__attemptTrackerCleanup.unref?.();
  }
}

/* =========================================================
   ROUTE
========================================================= */

export async function POST(request: Request) {
  /* -----------------------------------------------------
     PARSE BODY
  ----------------------------------------------------- */

  const body = await request.json().catch(() => null);

  const challengeToken =
    typeof body?.challengeToken === "string"
      ? body.challengeToken
      : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!challengeToken || !code) {
    return NextResponse.json(
      { error: "Missing challenge or code." },
      { status: 400 }
    );
  }

  /* -----------------------------------------------------
     AUDIT CONTEXT
  ----------------------------------------------------- */

  const ip = getAuditIp(request) ?? "unknown";
  const userAgent = getAuditUserAgent(request);

  /* -----------------------------------------------------
     ATTEMPT LIMIT CHECK
  ----------------------------------------------------- */

  if (getAttempts(challengeToken) >= MAX_ATTEMPTS_PER_CHALLENGE) {
    consumeTwoFactorChallenge(challengeToken);

    /*
     * We don't know the user id here — the challenge was
     * already consumed on previous attempts, so the map
     * no longer carries it. Log with user_id = null; the
     * metadata records the fact that the challenge was
     * exhausted, which is the security signal.
     */
    await logAuditEvent({
      userId: null,
      eventType: "auth.2fa.challenge_failed",
      severity: "warning",
      ipAddress: ip,
      userAgent,
      metadata: {
        reason: "attempts_exhausted",
        attempts: MAX_ATTEMPTS_PER_CHALLENGE,
      },
    });

    clearAttempts(challengeToken);

    return NextResponse.json(
      {
        error:
          "Too many verification attempts. Please sign in again.",
      },
      { status: 429 }
    );
  }

  /* -----------------------------------------------------
     CONSUME THE CHALLENGE TOKEN
  ----------------------------------------------------- */

  const userId = consumeTwoFactorChallenge(challengeToken);

  if (!userId) {
    /*
     * Expired or already-consumed challenge token. This is
     * expected when a user re-submits, or when an attacker
     * replays an old token. Not security-critical on its
     * own, so we don't audit it — logging every expired
     * token would flood the log during normal use.
     */
    return NextResponse.json(
      { error: "This challenge has expired. Please log in again." },
      { status: 401 }
    );
  }

  /* -----------------------------------------------------
     RECORD THIS ATTEMPT
  ----------------------------------------------------- */

  recordAttempt(challengeToken);

  /* -----------------------------------------------------
     LOAD USER
  ----------------------------------------------------- */

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
    if (user.twoFactorEmailCodeExpiresAt < new Date()) {
      return NextResponse.json(
        { error: "This code has expired. Please sign in again." },
        { status: 400 }
      );
    }

    const submittedHash = hashCode(code);

    if (submittedHash !== user.twoFactorEmailCodeHash) {
      await logAuditEvent({
        userId: user.id,
        eventType: "auth.2fa.challenge_failed",
        severity: "warning",
        ipAddress: ip,
        userAgent,
        metadata: { method: "email", reason: "invalid_code" },
      });

      return NextResponse.json(
        { error: "Invalid code." },
        { status: 401 }
      );
    }

    /* Success — clear the code so it can't be reused */
    await db
      .update(users)
      .set({
        twoFactorEmailCodeHash: null,
        twoFactorEmailCodeExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    clearAttempts(challengeToken);

    await createSession(user.id);

    await logAuditEvent({
      userId: user.id,
      eventType: "auth.login.success",
      severity: "info",
      ipAddress: ip,
      userAgent,
      metadata: { method: "2fa_email" },
    });

    return NextResponse.json({ success: true, method: "email" });
  }

  /* =========================================================
     PATH B — TOTP + RECOVERY CODES
  ========================================================= */

  if (user.twoFactorSecret) {
    const secret = decrypt(user.twoFactorSecret);

    let totpValid = false;

    try {
      const result = await verifyTotp({
        secret,
        token: code,
        epochTolerance: 30,
      });
      totpValid = result.valid;
    } catch {
      totpValid = false;
    }

    if (totpValid) {
      clearAttempts(challengeToken);
      await createSession(user.id);

      await logAuditEvent({
        userId: user.id,
        eventType: "auth.login.success",
        severity: "info",
        ipAddress: ip,
        userAgent,
        metadata: { method: "2fa_totp" },
      });

      return NextResponse.json({ success: true, method: "totp" });
    }

    /* Try recovery codes */
    const normalized = code
      .replace(/[^A-F0-9]/gi, "")
      .toUpperCase();

    if (normalized.length === 8) {
      const [recoveryCode] = await db
        .select()
        .from(twoFactorRecoveryCodes)
        .where(
          and(
            eq(twoFactorRecoveryCodes.userId, user.id),
            eq(
              twoFactorRecoveryCodes.codeHash,
              hashCode(normalized)
            ),
            isNull(twoFactorRecoveryCodes.usedAt)
          )
        )
        .limit(1);

      if (recoveryCode) {
        await db
          .update(twoFactorRecoveryCodes)
          .set({ usedAt: new Date() })
          .where(
            eq(twoFactorRecoveryCodes.id, recoveryCode.id)
          );

        clearAttempts(challengeToken);
        await createSession(user.id);

        /*
         * Two audit entries: the login itself (info), and
         * the fact that a recovery code was used (warning).
         * The second is the security signal — recovery
         * codes are backups, and their use often means the
         * primary authenticator was lost or compromised.
         */
        await logAuditEvent({
          userId: user.id,
          eventType: "auth.login.success",
          severity: "info",
          ipAddress: ip,
          userAgent,
          metadata: { method: "2fa_recovery_code" },
        });

        await logAuditEvent({
          userId: user.id,
          eventType: "auth.2fa.recovery_code_used",
          severity: "warning",
          ipAddress: ip,
          userAgent,
          metadata: { recoveryCodeId: recoveryCode.id },
        });

        return NextResponse.json({
          success: true,
          method: "recovery_code",
        });
      }
    }
  }

  /* =========================================================
     REJECT — invalid code, neither TOTP nor recovery matched
  ========================================================= */

  /*
   * Reaching this point means: no email code path was
   * applicable, no TOTP secret matched, and no recovery
   * code matched. That's an invalid code from a
   * challenge-token holder — the pattern of someone
   * trying to brute-force the second factor.
   */
  await logAuditEvent({
    userId: user.id,
    eventType: "auth.2fa.challenge_failed",
    severity: "warning",
    ipAddress: ip,
    userAgent,
    metadata: {
      method: user.twoFactorSecret ? "totp" : "email",
      reason: "invalid_code",
      attemptsThisChallenge: getAttempts(challengeToken),
    },
  });

  return NextResponse.json(
    { error: "Invalid code." },
    { status: 401 }
  );
}