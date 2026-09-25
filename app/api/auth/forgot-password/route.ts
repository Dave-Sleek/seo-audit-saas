import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { eq } from "drizzle-orm";

import { sendResetPasswordEmail } from "@/app/lib/email/send";
import {
  logAuditEvent,
  getAuditIp,
  getAuditUserAgent,
} from "@/app/lib/audit-log";

import { db } from "@/app/db";
import { users, passwordResetTokens } from "@/app/db/schema";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  try {
    /* -----------------------------------------------------
       PARSE BODY
    ----------------------------------------------------- */

    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    if (!email) {
      return NextResponse.json(
        { error: "Email address is required." },
        { status: 400 }
      );
    }

    /* -----------------------------------------------------
       AUDIT CONTEXT
    ----------------------------------------------------- */

    const ip = getAuditIp(request) ?? "unknown";
    const userAgent = getAuditUserAgent(request);

    /* -----------------------------------------------------
       RATE LIMIT — IP AND EMAIL
    ----------------------------------------------------- */

    const emailKey = createHash("sha256")
      .update(email)
      .digest("hex");

    const ipLimit = checkRateLimit(`ip:${ip}`);
    const emailLimit = checkRateLimit(`email:${emailKey}`);

    if (!ipLimit.allowed || !emailLimit.allowed) {
      /*
       * Return the same generic success response. See the
       * comment further down for why.
       */
      return NextResponse.json({ success: true });
    }

    /* -----------------------------------------------------
       RECORD THE ATTEMPT
    ----------------------------------------------------- */

    recordAttempt(`ip:${ip}`);
    recordAttempt(`email:${emailKey}`);

    /* -----------------------------------------------------
       LOOK UP USER
    ----------------------------------------------------- */

    const result = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    /*
     * Always return the same response whether or not the
     * account exists. Prevents account enumeration.
     */
    if (result.length === 0) {
      return NextResponse.json({ success: true });
    }

    const user = result[0];

    /* -----------------------------------------------------
       GENERATE + STORE TOKEN
    ----------------------------------------------------- */

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    /* -----------------------------------------------------
       AUDIT LOG — RESET REQUESTED
    ----------------------------------------------------- */

    /*
     * Severity is "warning", not "info". A password reset
     * request is legitimate most of the time but is also
     * the most common precursor to account takeover. If a
     * user reports suspicious activity, this is one of the
     * first events to review.
     */
    await logAuditEvent({
      userId: user.id,
      eventType: "auth.password.reset_requested",
      severity: "warning",
      ipAddress: ip,
      userAgent,
      metadata: { email: user.email },
    });

    /* -----------------------------------------------------
       SEND EMAIL
    ----------------------------------------------------- */

    try {
      await sendResetPasswordEmail({
        to: user.email,
        name: user.name,
        token: rawToken,
      });
    } catch (emailError) {
      console.error(
        "[forgot-password] email send failed:",
        emailError
      );
    }

    /* -----------------------------------------------------
       DEV CONVENIENCE
    ----------------------------------------------------- */

    if (process.env.NODE_ENV !== "production") {
      console.log("PASSWORD RESET TOKEN:", rawToken);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Forgot password error:", error);

    return NextResponse.json(
      { error: "Unable to process your request." },
      { status: 500 }
    );
  }
}

/* =========================================================
   RATE LIMITING
========================================================= */

/*
 * In-memory rate limiter. Keyed by "ip:<addr>" or
 * "email:<sha256>".
 *
 * 3 requests per 15 minutes. On serverless or multi-
 * instance deployments, replace with Redis, Upstash, or a
 * Postgres-backed counter.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 3;

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
    __forgotRateCleanup?: NodeJS.Timeout;
  };

  if (!g.__forgotRateCleanup) {
    g.__forgotRateCleanup = setInterval(
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

    g.__forgotRateCleanup.unref?.();
  }
}