import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { randomInt, createHash } from "crypto";

import { db } from "@/app/db";
import { users } from "@/app/db/schema";
import {
  verifyPassword,
  createSession,
  createTwoFactorChallenge,
} from "@/app/lib/auth";
import { sendTwoFactorCodeEmail } from "@/app/lib/email/send";

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function POST(request: Request) {
  /* -----------------------------------------------------
     RATE LIMIT
  ----------------------------------------------------- */

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const limit = checkLoginRateLimit(ip);

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)),
        },
      }
    );
  }

  /* -----------------------------------------------------
     PARSE BODY
  ----------------------------------------------------- */

  const body = await request.json().catch(() => null);

  const email =
    typeof body?.email === "string"
      ? body.email.trim().toLowerCase()
      : "";
  const password =
    typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  /* -----------------------------------------------------
     LOOK UP USER
  ----------------------------------------------------- */

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  /*
   * Dummy comparison keeps timing constant whether or not
   * the email exists. Prevents account enumeration.
   */
  if (!user) {
    await verifyPassword(
      password,
      "$2a$12$K5v8p9xJ3cYQzWZxVZ8eLOrT0qR4b9K2mN7d8F1gH3jP5sQ6uI7vC"
    );

    recordLoginFailure(ip);

    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }

  /* -----------------------------------------------------
     VERIFY PASSWORD
  ----------------------------------------------------- */

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    recordLoginFailure(ip);

    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }

  /* -----------------------------------------------------
     2FA BRANCH
  ----------------------------------------------------- */

  if (user.twoFactorEnabledAt) {
    /*
     * Prefer the explicit `twoFactorMethod` column. If it's
     * not set (older users, or before migration), fall back
     * to inference: presence of a TOTP secret → TOTP, else
     * email.
     */
    const method =
      user.twoFactorMethod ??
      (user.twoFactorSecret ? "totp" : "email");

    console.log("[login] 2FA required", {
      userId: user.id,
      method,
      hasTotp: Boolean(user.twoFactorSecret),
      storedMethod: user.twoFactorMethod,
    });

    /* ---------- TOTP path ---------- */

    if (method === "totp") {
      clearLoginFailures(ip);

      return NextResponse.json({
        requiresTwoFactor: true,
        method: "totp",
        challengeToken: createTwoFactorChallenge(user.id),
      });
    }

    /* ---------- Email OTP path ---------- */

    const code = String(randomInt(100000, 999999));
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db
      .update(users)
      .set({
        twoFactorEmailCodeHash: codeHash,
        twoFactorEmailCodeExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    console.log("[login] 2FA code generated", {
      userId: user.id,
      email: user.email,
      expiresAt: expiresAt.toISOString(),
    });

    /*
     * sendTwoFactorCodeEmail() returns a boolean. It does NOT
     * throw on Resend failures — it logs and returns false.
     * So we need to check the return value, not just wrap in
     * try/catch.
     */
    let emailSent = false;
    let emailError: unknown = null;

    try {
      emailSent = await sendTwoFactorCodeEmail({
        to: user.email,
        name: user.name,
        code,
      });
    } catch (err) {
      emailError = err;
    }

    if (!emailSent) {
      console.error("[login] 2FA email send failed", {
        userId: user.id,
        email: user.email,
        error: emailError,
      });
    } else {
      console.log("[login] 2FA email sent", {
        userId: user.id,
        email: user.email,
      });
    }

    clearLoginFailures(ip);

    /*
     * Return the challenge even if the email failed — the user
     * will see the code entry screen and can hit Resend.
     * Failing the login here would leave them stuck.
     */
    return NextResponse.json({
      requiresTwoFactor: true,
      method: "email",
      challengeToken: createTwoFactorChallenge(user.id),
    });
  }

  /* -----------------------------------------------------
     NO 2FA — CREATE SESSION
  ----------------------------------------------------- */

  clearLoginFailures(ip);

  await createSession(user.id);

  return NextResponse.json({ success: true });
}

/* =========================================================
   RATE LIMITING
========================================================= */

/*
 * In-memory rate limiter. Fine for a single-instance
 * deployment, but on Vercel/serverless each invocation may
 * be a different process — replace with Redis, Upstash, or
 * a Postgres-backed counter if you deploy multi-instance.
 */

const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_MAX_ATTEMPTS = 5;

type RateBucket = {
  failures: number;
  resetAt: number;
};

const loginBuckets = new Map<string, RateBucket>();

function checkLoginRateLimit(ip: string): {
  allowed: boolean;
  retryAfterMs: number;
} {
  const now = Date.now();
  const bucket = loginBuckets.get(ip);

  if (!bucket || bucket.resetAt < now) {
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.failures >= LOGIN_MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterMs: bucket.resetAt - now,
    };
  }

  return { allowed: true, retryAfterMs: 0 };
}

function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const bucket = loginBuckets.get(ip);

  if (!bucket || bucket.resetAt < now) {
    loginBuckets.set(ip, {
      failures: 1,
      resetAt: now + LOGIN_WINDOW_MS,
    });
    return;
  }

  bucket.failures += 1;
}

function clearLoginFailures(ip: string): void {
  loginBuckets.delete(ip);
}

/*
 * Periodic cleanup so the Map doesn't grow unbounded in
 * long-lived processes. Runs every 10 minutes.
 */
if (typeof globalThis !== "undefined") {
  const g = globalThis as typeof globalThis & {
    __loginRateCleanup?: NodeJS.Timeout;
  };

  if (!g.__loginRateCleanup) {
    g.__loginRateCleanup = setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of loginBuckets) {
        if (bucket.resetAt < now) {
          loginBuckets.delete(key);
        }
      }
    }, 10 * 60 * 1000);

    g.__loginRateCleanup.unref?.();
  }
}