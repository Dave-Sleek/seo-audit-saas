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
import {
  logAuditEvent,
  getAuditIp,
  getAuditUserAgent,
} from "@/app/lib/audit-log";

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

/* =========================================================
   TIMING-SAFE DUMMY HASH
========================================================= */

/*
 * A real scrypt hash of the string "dummy-password",
 * generated with the same parameters as hashPassword().
 *
 * Purpose: when the login email doesn't exist, we still run
 * a real scrypt comparison so the response time is
 * indistinguishable from a wrong-password attempt on a real
 * account. This blocks timing-based account enumeration.
 *
 * Do NOT replace this with a bcrypt hash — verifyPassword
 * expects the "salt:hash" scrypt format, and a bcrypt string
 * would fail the format check and return instantly, defeating
 * the point.
 *
 * To regenerate:
 *   node -e "const {randomBytes,scryptSync}=require('crypto');const s=randomBytes(16).toString('hex');console.log(s+':'+scryptSync('dummy-password',s,64).toString('hex'))"
 */
const DUMMY_PASSWORD_HASH =
  "ca40bba7b1097ac2058403336827f324:dd257d13a4580640035011c24ffd416b546fb0829a8513bad9007c33d9fa3bee05b3a3cf3b33b0c6165b0aa5ab5540a1932c76b65e66d140eaf0dc8d40addb4b";

export async function POST(request: Request) {
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
     AUDIT CONTEXT
  ----------------------------------------------------- */

  /*
   * Capture the IP and user agent once so every audit entry
   * in this request uses the same values.
   */
  const ip = getAuditIp(request);
  const userAgent = getAuditUserAgent(request);

  /* -----------------------------------------------------
     RATE LIMIT — IP AND EMAIL
  ----------------------------------------------------- */

  /*
   * Two buckets. A failure in either blocks the attempt.
   *
   * - Per-IP: prevents one machine from spraying many accounts.
   * - Per-email: prevents a botnet from targeting one account
   *   from many IPs.
   *
   * The email bucket uses a hash of the email as the key so
   * plaintext addresses never linger in the in-memory map.
   */
  const emailKey = createHash("sha256").update(email).digest("hex");

  const ipLimit = checkLoginRateLimit(`ip:${ip}`);
  const emailLimit = checkLoginRateLimit(`email:${emailKey}`);

  if (!ipLimit.allowed || !emailLimit.allowed) {
    const retryAfterMs = Math.max(
      ipLimit.allowed ? 0 : ipLimit.retryAfterMs,
      emailLimit.allowed ? 0 : emailLimit.retryAfterMs
    );

    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
        },
      }
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

  /* -----------------------------------------------------
     USER NOT FOUND — DUMMY COMPARISON
  ----------------------------------------------------- */

  if (!user) {
    /*
     * Run a real scrypt comparison so timing matches a
     * wrong-password attempt on a real account. Blocks
     * timing-based account enumeration.
     */
    await verifyPassword(password, DUMMY_PASSWORD_HASH);

    recordLoginFailure(`ip:${ip}`);
    recordLoginFailure(`email:${emailKey}`);

    await logAuditEvent({
      userId: null,
      eventType: "auth.login.failed",
      severity: "warning",
      ipAddress: ip,
      userAgent,
      metadata: {
        reason: "unknown_email",
        attemptedEmail: email,
      },
    });

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
    recordLoginFailure(`ip:${ip}`);
    recordLoginFailure(`email:${emailKey}`);

    await logAuditEvent({
      userId: user.id,
      eventType: "auth.login.failed",
      severity: "warning",
      ipAddress: ip,
      userAgent,
      metadata: { reason: "wrong_password" },
    });

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
     * Prefer the explicit twoFactorMethod column. Fall back
     * to inference for older users: presence of a TOTP
     * secret means TOTP, otherwise email.
     */
    const method =
      user.twoFactorMethod ??
      (user.twoFactorSecret ? "totp" : "email");

    /* ---------- TOTP path ---------- */

    if (method === "totp") {
      clearLoginFailures(`ip:${ip}`);
      clearLoginFailures(`email:${emailKey}`);

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

    /*
     * Fire-and-forget: don't block the response on Resend.
     *
     * Note: on serverless platforms, the function may be
     * frozen after the response is sent and the email may
     * never go out. Move to a background job queue if you
     * deploy to Vercel or similar.
     */
    void sendTwoFactorCodeEmail({
      to: user.email,
      name: user.name,
      code,
    })
      .then((sent) => {
        if (!sent) {
          console.error("[login] 2FA email send failed", {
            userId: user.id,
            email: user.email,
          });
        }
      })
      .catch((err) => {
        console.error("[login] 2FA email threw", {
          userId: user.id,
          email: user.email,
          error: err,
        });
      });

    clearLoginFailures(`ip:${ip}`);
    clearLoginFailures(`email:${emailKey}`);

    return NextResponse.json({
      requiresTwoFactor: true,
      method: "email",
      challengeToken: createTwoFactorChallenge(user.id),
    });
  }

  /* -----------------------------------------------------
     NO 2FA — CREATE SESSION
  ----------------------------------------------------- */

  clearLoginFailures(`ip:${ip}`);
  clearLoginFailures(`email:${emailKey}`);

  await createSession(user.id);

  await logAuditEvent({
    userId: user.id,
    eventType: "auth.login.success",
    severity: "info",
    ipAddress: ip,
    userAgent,
    metadata: { method: "password" },
  });

  return NextResponse.json({ success: true });
}

/* =========================================================
   HELPERS
========================================================= */

/**
 * Extract the client IP from request headers.
 *
 * x-forwarded-for can be spoofed by the client if the app
 * isn't behind a trusted proxy that strips the incoming
 * header. Ensure your proxy (Vercel, Cloudflare, nginx) is
 * configured to overwrite it before the request reaches the
 * app.
 *
 * If neither header is present (direct local development),
 * falls back to "unknown" — every such request shares one
 * bucket, which is a DoS vector in production. Configure
 * the proxy so this case never occurs.
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
 * In-memory rate limiter. Keyed by "ip:<addr>" or
 * "email:<sha256>", each with its own bucket.
 *
 * Works for a single Node process. On serverless or
 * multi-instance deployments, replace with Redis, Upstash,
 * or a Postgres-backed counter.
 */

const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_MAX_ATTEMPTS = 5;

type RateBucket = {
  failures: number;
  resetAt: number;
};

const loginBuckets = new Map<string, RateBucket>();

function checkLoginRateLimit(key: string): {
  allowed: boolean;
  retryAfterMs: number;
} {
  const now = Date.now();
  const bucket = loginBuckets.get(key);

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

function recordLoginFailure(key: string): void {
  const now = Date.now();
  const bucket = loginBuckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    loginBuckets.set(key, {
      failures: 1,
      resetAt: now + LOGIN_WINDOW_MS,
    });
    return;
  }

  bucket.failures += 1;
}

function clearLoginFailures(key: string): void {
  loginBuckets.delete(key);
}

/* Periodic cleanup so the Map doesn't grow unbounded. */
if (typeof globalThis !== "undefined") {
  const g = globalThis as typeof globalThis & {
    __loginRateCleanup?: NodeJS.Timeout;
  };

  if (!g.__loginRateCleanup) {
    g.__loginRateCleanup = setInterval(
      () => {
        const now = Date.now();
        for (const [key, bucket] of loginBuckets) {
          if (bucket.resetAt < now) {
            loginBuckets.delete(key);
          }
        }
      },
      10 * 60 * 1000
    );

    g.__loginRateCleanup.unref?.();
  }
}