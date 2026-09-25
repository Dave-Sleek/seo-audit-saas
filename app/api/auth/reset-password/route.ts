import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/app/db";

import {
  users,
  sessions,
  passwordResetTokens,
} from "@/app/db/schema";

import { hashPassword } from "@/app/lib/auth";
import {
  logAuditEvent,
  getAuditIp,
  getAuditUserAgent,
} from "@/app/lib/audit-log";

/* =========================================================
   HELPERS
========================================================= */

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/* =========================================================
   POST /api/auth/reset-password
========================================================= */

export async function POST(request: Request) {
  try {
    /* -----------------------------------------------------
       PARSE BODY
    ----------------------------------------------------- */

    let body: {
      token?: unknown;
      password?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const token =
      typeof body.token === "string" ? body.token : "";

    const password =
      typeof body.password === "string" ? body.password : "";

    /* -----------------------------------------------------
       AUDIT CONTEXT
    ----------------------------------------------------- */

    const ip = getAuditIp(request) ?? "unknown";
    const userAgent = getAuditUserAgent(request);

    /* -----------------------------------------------------
       RATE LIMIT — IP AND TOKEN
    ----------------------------------------------------- */

    const tokenKey = token
      ? createHash("sha256").update(token).digest("hex")
      : "missing";

    const ipLimit = checkRateLimit(`ip:${ip}`);
    const tokenLimit = checkRateLimit(`token:${tokenKey}`);

    if (!ipLimit.allowed || !tokenLimit.allowed) {
      const retryAfterMs = Math.max(
        ipLimit.allowed ? 0 : ipLimit.retryAfterMs,
        tokenLimit.allowed ? 0 : tokenLimit.retryAfterMs
      );

      return NextResponse.json(
        {
          error: "Too many attempts. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil(retryAfterMs / 1000)
            ),
          },
        }
      );
    }

    /* -----------------------------------------------------
       RECORD THE ATTEMPT
    ----------------------------------------------------- */

    recordAttempt(`ip:${ip}`);
    recordAttempt(`token:${tokenKey}`);

    /* -----------------------------------------------------
       VALIDATE INPUT
    ----------------------------------------------------- */

    if (!token) {
      return NextResponse.json(
        { error: "Invalid reset token." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    /* -----------------------------------------------------
       LOOK UP UNUSED TOKEN
    ----------------------------------------------------- */

    const tokenHash = hashToken(token);

    const result = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt)
        )
      )
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        {
          error:
            "This reset link is invalid or has already been used.",
        },
        { status: 400 }
      );
    }

    const resetToken = result[0];

    /* -----------------------------------------------------
       CHECK EXPIRY
    ----------------------------------------------------- */

    if (resetToken.expiresAt <= new Date()) {
      return NextResponse.json(
        { error: "This reset link has expired." },
        { status: 400 }
      );
    }

    /* -----------------------------------------------------
       HASH NEW PASSWORD
    ----------------------------------------------------- */

    const passwordHash = await hashPassword(password);

    /* -----------------------------------------------------
       APPLY CHANGES IN A TRANSACTION
    ----------------------------------------------------- */

    /*
     * All three writes happen together so a partial failure
     * doesn't leave the token marked as used but the
     * password unchanged (or vice versa).
     */
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          passwordHash,
          updatedAt: new Date(),
        })
        .where(eq(users.id, resetToken.userId));

      await tx
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, resetToken.id));

      /*
       * Changing a password signs the user out from every
       * device. Prevents an attacker with a stolen session
       * from remaining logged in after a reset.
       */
      await tx
        .delete(sessions)
        .where(eq(sessions.userId, resetToken.userId));
    });

    /* -----------------------------------------------------
       AUDIT LOG — RESET COMPLETED
    ----------------------------------------------------- */

    /*
     * Fire after the transaction commits. If the DB writes
     * rolled back, we must not log a success — the audit
     * entry is a statement about what happened, so it has
     * to reflect the committed state.
     *
     * Severity is "warning": a legitimate user action, but
     * the same event an attacker would trigger after
     * compromising an email account.
     */
    await logAuditEvent({
      userId: resetToken.userId,
      eventType: "auth.password.reset_completed",
      severity: "warning",
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);

    return NextResponse.json(
      { error: "Unable to reset your password." },
      { status: 500 }
    );
  }
}

/* =========================================================
   RATE LIMITING
========================================================= */

/*
 * In-memory rate limiter. Keyed by "ip:<addr>" or
 * "token:<sha256>".
 *
 * 5 attempts per 15 minutes. On serverless or multi-
 * instance deployments, replace with Redis, Upstash, or a
 * Postgres-backed counter.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

type Bucket = {
  attempts: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function checkRateLimit(key: string): {
  allowed: boolean;
  retryAfterMs: number;
} {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.attempts >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterMs: bucket.resetAt - now,
    };
  }

  return { allowed: true, retryAfterMs: 0 };
}

function recordAttempt(key: string): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, {
      attempts: 1,
      resetAt: now + WINDOW_MS,
    });
    return;
  }

  bucket.attempts += 1;
}

/* Periodic cleanup so the Map doesn't grow unbounded. */
if (typeof globalThis !== "undefined") {
  const g = globalThis as typeof globalThis & {
    __resetRateCleanup?: NodeJS.Timeout;
  };

  if (!g.__resetRateCleanup) {
    g.__resetRateCleanup = setInterval(
      () => {
        const now = Date.now();
        for (const [key, bucket] of buckets) {
          if (bucket.resetAt < now) {
            buckets.delete(key);
          }
        }
      },
      10 * 60 * 1000
    );

    g.__resetRateCleanup.unref?.();
  }
}