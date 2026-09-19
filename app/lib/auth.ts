import { cookies } from "next/headers";
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import { and, eq } from "drizzle-orm";

import { db } from "@/app/db";
import {
  users,
  sessions,
} from "@/app/db/schema";

const SESSION_COOKIE = "seo_session";

const SESSION_DURATION_DAYS = 30;

/**
 * Hash a session token before storing/checking it in the database.
 */
function hashToken(token: string) {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

/**
 * Hash a password using Node's built-in scrypt.
 */
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");

  const hash = scryptSync(
    password,
    salt,
    64
  ).toString("hex");

  return `${salt}:${hash}`;
}

/**
 * Verify a plain-text password against a stored
 * salt:hash password value.
 */
export function verifyPassword(
  password: string,
  storedPassword: string
) {
  const [salt, storedHash] =
    storedPassword.split(":");

  if (!salt || !storedHash) {
    return false;
  }

  const hash = scryptSync(
    password,
    salt,
    64
  ).toString("hex");

  const storedBuffer = Buffer.from(
    storedHash,
    "hex"
  );

  const hashBuffer = Buffer.from(
    hash,
    "hex"
  );

  if (
    storedBuffer.length !== hashBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    storedBuffer,
    hashBuffer
  );
}

/**
 * Create a new authenticated session.
 */
export async function createSession(
  userId: string
) {
  const token = randomBytes(32).toString("hex");

  const tokenHash = hashToken(token);

  const expiresAt = new Date();

  expiresAt.setDate(
    expiresAt.getDate() +
      SESSION_DURATION_DAYS
  );

  await db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt,
  });

  const cookieStore = await cookies();

  cookieStore.set(
    SESSION_COOKIE,
    token,
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    }
  );

  return token;
}

/**
 * Get the currently authenticated user.
 *
 * Includes the user's role so admin-protected
 * pages and API routes can use:
 *
 * user.role === "admin"
 */
export async function getCurrentUser() {
  const cookieStore = await cookies();

  const token = cookieStore.get(
    SESSION_COOKIE
  )?.value;

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
        emailVerifiedAt:
          users.emailVerifiedAt,
      },
      session: {
        expiresAt: sessions.expiresAt,
      },
    })
    .from(sessions)
    .innerJoin(
      users,
      eq(sessions.userId, users.id)
    )
    .where(
      eq(
        sessions.tokenHash,
        tokenHash
      )
    )
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const currentSession = result[0];

  /**
   * Remove expired sessions immediately.
   */
  if (
    currentSession.session.expiresAt <=
    new Date()
  ) {
    await db
      .delete(sessions)
      .where(
        and(
          eq(
            sessions.tokenHash,
            tokenHash
          ),
          eq(
            sessions.userId,
            currentSession.user.id
          )
        )
      );

    cookieStore.delete(
      SESSION_COOKIE
    );

    return null;
  }

  return currentSession.user;
}

/**
 * Destroy the current authenticated session.
 */
export async function destroySession() {
  const cookieStore = await cookies();

  const token = cookieStore.get(
    SESSION_COOKIE
  )?.value;

  if (token) {
    const tokenHash = hashToken(token);

    await db
      .delete(sessions)
      .where(
        eq(
          sessions.tokenHash,
          tokenHash
        )
      );
  }

  cookieStore.delete(
    SESSION_COOKIE
  );
}