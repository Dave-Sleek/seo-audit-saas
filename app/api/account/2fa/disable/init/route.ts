// app/api/account/2fa/disable/init/route.ts

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { randomInt, createHash } from "crypto";

import { getCurrentUser, verifyPassword } from "@/app/lib/auth";
import { db } from "@/app/db";
import { users } from "@/app/db/schema";
import { sendTwoFactorCodeEmail } from "@/app/lib/email/send";

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function POST(request: Request) {
  /* -----------------------------------------------------
     AUTH
  ----------------------------------------------------- */

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  /* -----------------------------------------------------
     RATE LIMIT — USER AND IP
  ----------------------------------------------------- */

  /*
   * Two buckets, both must pass.
   *
   * - Per-user: prevents a scripted session from hammering
   *   one account's verification flow. Even a legitimate
   *   user shouldn't need to resend more than a couple of
   *   times per 10 minutes.
   *
   * - Per-IP: prevents a botnet or a shared NAT from
   *   flooding this endpoint across many accounts.
   *
   * 3 per 10 minutes is tight. A real user who mistypes
   * their password twice, then gets the code right on the
   * third attempt, uses 3 total. Anything more is either a
   * genuine mistake streak or abuse.
   */
  const ip = getClientIp(request);

  const userLimit = checkRateLimit(`user:${user.id}`);
  const ipLimit = checkRateLimit(`ip:${ip}`);

  if (!userLimit.allowed || !ipLimit.allowed) {
    const retryAfterMs = Math.max(
      userLimit.allowed ? 0 : userLimit.retryAfterMs,
      ipLimit.allowed ? 0 : ipLimit.retryAfterMs
    );

    return NextResponse.json(
      {
        error:
          "Too many verification code requests. Please try again later.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
        },
      }
    );
  }

  /* -----------------------------------------------------
     PARSE BODY
  ----------------------------------------------------- */

  const body = await request.json().catch(() => null);
  const password =
    typeof body?.password === "string" ? body.password : "";

  if (!password) {
    return NextResponse.json(
      { error: "Password is required." },
      { status: 400 }
    );
  }

  /* -----------------------------------------------------
     LOAD FRESH USER
  ----------------------------------------------------- */

  const [freshUser] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      passwordHash: users.passwordHash,
      twoFactorEnabledAt: users.twoFactorEnabledAt,
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

  /* -----------------------------------------------------
     VERIFY PASSWORD
  ----------------------------------------------------- */

  const passwordValid = await verifyPassword(
    password,
    freshUser.passwordHash
  );

  if (!passwordValid) {
    /*
     * Wrong password consumes the rate-limit quota. This
     * is important: otherwise an attacker could brute-force
     * the password field forever and only ever get 401s
     * without hitting the limiter.
     */
    recordAttempt(`user:${user.id}`);
    recordAttempt(`ip:${ip}`);

    return NextResponse.json(
      { error: "Incorrect password." },
      { status: 401 }
    );
  }

  /* -----------------------------------------------------
     GENERATE + STORE CODE
  ----------------------------------------------------- */

  const code = String(randomInt(100000, 999999));
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await db
    .update(users)
    .set({
      twoFactorEmailCodeHash: codeHash,
      twoFactorEmailCodeExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  /* -----------------------------------------------------
     SEND EMAIL
  ----------------------------------------------------- */

  let emailSent = false;
  let emailError: unknown = null;

  try {
    emailSent = await sendTwoFactorCodeEmail({
      to: freshUser.email,
      name: freshUser.name,
      code,
    });
  } catch (err) {
    emailError = err;
  }

  if (!emailSent) {
    console.error("[2fa/disable/init] email send failed", {
      userId: user.id,
      error: emailError,
    });

    return NextResponse.json(
      {
        error:
          "Unable to send the verification code. Please try again.",
      },
      { status: 500 }
    );
  }

  /* -----------------------------------------------------
     RECORD SUCCESSFUL SEND
  ----------------------------------------------------- */

  /*
   * Count the successful attempt too. Otherwise a script
   * with the correct password could send unlimited emails
   * by only ever succeeding.
   */
  recordAttempt(`user:${user.id}`);
  recordAttempt(`ip:${ip}`);

  return NextResponse.json({ success: true });
}

/* =========================================================
   HELPERS
========================================================= */

/**
 * Extract the client IP from request headers.
 *
 * x-forwarded-for can be spoofed if the app isn't behind a
 * trusted proxy that overwrites it. Configure your proxy
 * accordingly before deploying.
 */
function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();

  return "unknown";
}

/* =========================================================
   RATE LIMITING
========================================================= */

/*
 * In-memory rate limiter. Keyed by "user:<id>" or "ip:<addr>".
 *
 * 3 attempts per 10 minutes. Both a wrong password and a
 * successful send consume an attempt — this prevents an
 * attacker from brute-forcing the password field (only
 * counting successes) and from spamming the email endpoint
 * (only counting failures).
 *
 * On serverless or multi-instance deployments, replace with
 * Redis, Upstash, or a Postgres-backed counter.
 */

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
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
    __twoFactorRateCleanup?: NodeJS.Timeout;
  };

  if (!g.__twoFactorRateCleanup) {
    g.__twoFactorRateCleanup = setInterval(
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

    g.__twoFactorRateCleanup.unref?.();
  }
}