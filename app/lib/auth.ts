import { cookies } from "next/headers";
import {
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "crypto";
import { promisify } from "util";
import { and, eq, lte } from "drizzle-orm";

import { db } from "@/app/db";
import { users, sessions } from "@/app/db/schema";

/* =========================================================
   CONSTANTS
========================================================= */

const SESSION_COOKIE = "seo_session";
const SESSION_DURATION_DAYS = 30;
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number
) => Promise<Buffer>;

/* =========================================================
   INTERNAL HELPERS
========================================================= */

/**
 * Hash a session token or other opaque secret before storing
 * or comparing it in the database.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/* =========================================================
   PASSWORDS
========================================================= */

/**
 * Hash a password using Node's built-in scrypt.
 *
 * Returns a `salt:hash` string. Both parts are hex-encoded.
 *
 * Uses the async `scrypt` so the event loop isn't blocked
 * while the hash is computed (~100ms per call on typical
 * hardware).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a plain-text password against a stored `salt:hash`
 * value. Constant-time comparison on the hash.
 *
 * Returns false for any malformed stored value rather than
 * throwing — a corrupted row should not 500 the login route.
 */
export async function verifyPassword(
  password: string,
  storedPassword: string
): Promise<boolean> {
  const [salt, storedHash] = storedPassword.split(":");

  if (!salt || !storedHash) {
    return false;
  }

  const hashBuffer = await scryptAsync(password, salt, 64);
  const storedBuffer = Buffer.from(storedHash, "hex");

  if (storedBuffer.length !== hashBuffer.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, hashBuffer);
}

/* =========================================================
   SESSIONS
========================================================= */

/**
 * Create a new authenticated session and set the cookie.
 */
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt,
  });

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return token;
}

/**
 * Get the currently authenticated user, or null.
 *
 * - Includes role for admin-protected pages and routes.
 * - Includes 2FA state flags but NOT the encrypted TOTP
 *   secret, so it can't accidentally leak into a client
 *   component or a log.
 * - Expires the session immediately if it's past its
 *   expiration, and cleans up the DB row + cookie.
 */
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);

  const result = await db
    .select({
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        emailVerifiedAt: users.emailVerifiedAt,

        // 2FA state — NOT the encrypted TOTP secret
        twoFactorEnabledAt: users.twoFactorEnabledAt,
        twoFactorEmailCodeHash: users.twoFactorEmailCodeHash,
        twoFactorEmailCodeExpiresAt:
          users.twoFactorEmailCodeExpiresAt,
      },
      session: {
        expiresAt: sessions.expiresAt,
      },
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const currentSession = result[0];

  /* ---------- Expired session — clean up immediately ---------- */

  if (currentSession.session.expiresAt <= new Date()) {
    await db
      .delete(sessions)
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          eq(sessions.userId, currentSession.user.id)
        )
      );

    cookieStore.delete(SESSION_COOKIE);

    return null;
  }

  /* ---------- Opportunistic sweep of other expired sessions ---------- */

  /*
   * ~1% of requests trigger a background cleanup of all
   * expired sessions. Over a day, this clears the table
   * without needing a cron job. Failures are swallowed so
   * they never affect the current request.
   */
  if (Math.random() < 0.01) {
    void db
      .delete(sessions)
      .where(lte(sessions.expiresAt, new Date()))
      .catch((err) => {
        console.error("[auth] session sweep failed:", err);
      });
  }

  return currentSession.user;
}

/**
 * Destroy the current authenticated session and clear the
 * cookie.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    const tokenHash = hashToken(token);

    await db
      .delete(sessions)
      .where(eq(sessions.tokenHash, tokenHash));
  }

  cookieStore.delete(SESSION_COOKIE);
}

/* =========================================================
   TWO-FACTOR CHALLENGES
========================================================= */

/*
 * In-memory store for short-lived 2FA challenges.
 *
 * Fine for a single Node process. On serverless or
 * multi-instance deployments, move this to Redis or a
 * Postgres table with a token_hash primary key and an
 * expires_at column.
 *
 * A periodic sweep removes expired entries so the map
 * doesn't grow unbounded.
 */

const challenges = new Map<
  string,
  { userId: string; expiresAt: number }
>();

export function createTwoFactorChallenge(userId: string): string {
  const token = randomBytes(32).toString("hex");

  challenges.set(token, {
    userId,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  });

  return token;
}

export function consumeTwoFactorChallenge(
  token: string
): string | null {
  const entry = challenges.get(token);

  if (!entry) return null;

  challenges.delete(token);

  if (entry.expiresAt < Date.now()) return null;

  return entry.userId;
}

/* ---------- Sweep expired challenges every minute ---------- */

if (typeof globalThis !== "undefined") {
  const g = globalThis as typeof globalThis & {
    __challengeSweep?: NodeJS.Timeout;
  };

  if (!g.__challengeSweep) {
    g.__challengeSweep = setInterval(() => {
      const now = Date.now();

      for (const [token, entry] of challenges) {
        if (entry.expiresAt < now) {
          challenges.delete(token);
        }
      }
    }, 60 * 1000);

    g.__challengeSweep.unref?.();
  }
}