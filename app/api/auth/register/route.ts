import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";

import { grantFreeSubscription } from "@/app/lib/subscription";
import {
  sendVerificationEmail,
  sendWelcomeEmail,
} from "@/app/lib/email/send";
import {
  logAuditEvent,
  getAuditIp,
  getAuditUserAgent,
} from "@/app/lib/audit-log";

import { db } from "@/app/db";
import {
  users,
  emailVerificationTokens,
} from "@/app/db/schema";

import {
  createSession,
  hashPassword,
} from "@/app/lib/auth";

/* =========================================================
   EMAIL VALIDATION
========================================================= */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    /* -----------------------------------------------------
       PARSE BODY
    ----------------------------------------------------- */

    const body = await request.json();

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string" ? body.password : "";

    /* -----------------------------------------------------
       AUDIT CONTEXT
    ----------------------------------------------------- */

    const ip = getAuditIp(request) ?? "unknown";
    const userAgent = getAuditUserAgent(request);

    /* -----------------------------------------------------
       RATE LIMIT
    ----------------------------------------------------- */

    /*
     * Signups from one IP should be rare. Three per hour is
     * generous for a real person (typos, multiple accounts
     * for testing) but tight enough to block scripted mass
     * account creation.
     *
     * Keyed by IP only — there's no email yet at this point,
     * and a fresh email per attempt would defeat an
     * email-keyed bucket anyway.
     */
    const limit = checkRegisterRateLimit(`ip:${ip}`);

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error:
            "Too many signup attempts. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil(limit.retryAfterMs / 1000)
            ),
          },
        }
      );
    }

    /* -----------------------------------------------------
       VALIDATION
    ----------------------------------------------------- */

    if (!name) {
      return NextResponse.json(
        { error: "Please enter your name." },
        { status: 400 }
      );
    }

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
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
       CHECK FOR EXISTING ACCOUNT
    ----------------------------------------------------- */

    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    /* -----------------------------------------------------
       CREATE USER
    ----------------------------------------------------- */

    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
      });

    if (!user) {
      throw new Error("User insert returned no row.");
    }

    /* -----------------------------------------------------
       AUDIT LOG — ACCOUNT CREATED
    ----------------------------------------------------- */

    /*
     * Log immediately after the insert, before the session
     * is created. If any of the downstream steps fail
     * (verification email, free subscription), the account
     * still exists and the audit entry must reflect that.
     */
    await logAuditEvent({
      userId: user.id,
      eventType: "account.registered",
      severity: "info",
      ipAddress: ip,
      userAgent,
      metadata: {
        email: user.email,
        name: user.name,
      },
    });

    /* -----------------------------------------------------
       RECORD THE ATTEMPT
    ----------------------------------------------------- */

    /*
     * Only count the attempt once the user is actually
     * created. Failed validation, duplicate emails, and
     * thrown errors don't consume the quota — a legitimate
     * user retrying after a typo shouldn't burn an attempt.
     */
    recordRegisterAttempt(`ip:${ip}`);

    /* -----------------------------------------------------
       CREATE SESSION
    ----------------------------------------------------- */

    await createSession(user.id);

    /* -----------------------------------------------------
       SEND VERIFICATION EMAIL
    ----------------------------------------------------- */

    try {
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256")
        .update(rawToken)
        .digest("hex");
      const expiresAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      );

      await db.insert(emailVerificationTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      await sendVerificationEmail({
        to: user.email,
        name: user.name,
        token: rawToken,
      });
    } catch (verifyError) {
      console.error(
        "[signup] verification email failed:",
        verifyError
      );
    }

    /* -----------------------------------------------------
       GRANT FREE SUBSCRIPTION
    ----------------------------------------------------- */

    try {
      await grantFreeSubscription(user.id);
    } catch (freeError) {
      console.error(
        "[signup] failed to grant Free subscription:",
        freeError
      );
    }

    /* -----------------------------------------------------
       SEND WELCOME EMAIL
    ----------------------------------------------------- */

    try {
      await sendWelcomeEmail({
        to: user.email,
        name: user.name,
      });
    } catch (emailError) {
      console.error(
        "[signup] welcome email failed:",
        emailError
      );
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Registration error:", error);

    return NextResponse.json(
      { error: "Unable to create your account." },
      { status: 500 }
    );
  }
}

/* =========================================================
   RATE LIMITING
========================================================= */

/*
 * In-memory rate limiter for registration. Keyed by IP.
 *
 * 3 signups per hour per IP. Beyond that, the request is
 * rejected with a Retry-After header.
 *
 * On serverless or multi-instance deployments, replace with
 * Redis, Upstash, or a Postgres-backed counter.
 */

const REGISTER_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const REGISTER_MAX_ATTEMPTS = 3;

type RegisterBucket = {
  attempts: number;
  resetAt: number;
};

const registerBuckets = new Map<string, RegisterBucket>();

function checkRegisterRateLimit(key: string): {
  allowed: boolean;
  retryAfterMs: number;
} {
  const now = Date.now();
  const bucket = registerBuckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.attempts >= REGISTER_MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterMs: bucket.resetAt - now,
    };
  }

  return { allowed: true, retryAfterMs: 0 };
}

function recordRegisterAttempt(key: string): void {
  const now = Date.now();
  const bucket = registerBuckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    registerBuckets.set(key, {
      attempts: 1,
      resetAt: now + REGISTER_WINDOW_MS,
    });
    return;
  }

  bucket.attempts += 1;
}

/* Periodic cleanup so the Map doesn't grow unbounded. */
if (typeof globalThis !== "undefined") {
  const g = globalThis as typeof globalThis & {
    __registerRateCleanup?: NodeJS.Timeout;
  };

  if (!g.__registerRateCleanup) {
    g.__registerRateCleanup = setInterval(
      () => {
        const now = Date.now();
        for (const [key, bucket] of registerBuckets) {
          if (bucket.resetAt < now) {
            registerBuckets.delete(key);
          }
        }
      },
      10 * 60 * 1000
    );

    g.__registerRateCleanup.unref?.();
  }
}