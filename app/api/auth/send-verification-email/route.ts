import { NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import { users, emailVerificationTokens } from "@/app/db/schema";
import { sendVerificationEmail } from "@/app/lib/email/send";

/*
 * Minimum age (ms) of the most recent unexpired token before
 * we allow another one to be sent. Prevents accidental
 * email-bombing when a user clicks "Resend" repeatedly.
 */
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute

/*
 * How long a verification link stays valid.
 */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  /* ---------- Already verified — nothing to do ---------- */

  if (user.emailVerifiedAt) {
    return NextResponse.json({
      success: true,
      alreadyVerified: true,
    });
  }

  /* ---------- Rate limit ---------- */

  const now = new Date();
  const cooldownCutoff = new Date(
    now.getTime() - RESEND_COOLDOWN_MS
  );

  const [recentToken] = await db
    .select({ createdAt: emailVerificationTokens.createdAt })
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.userId, user.id),
        isNull(emailVerificationTokens.usedAt),
        gt(emailVerificationTokens.expiresAt, now),
        gt(emailVerificationTokens.createdAt, cooldownCutoff)
      )
    )
    .limit(1);

  if (recentToken) {
    return NextResponse.json(
      {
        error:
          "We recently sent you a verification email. Please check your inbox before requesting another.",
        code: "COOLDOWN",
      },
      { status: 429 }
    );
  }

  /* ---------- Generate a fresh token ---------- */

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);

  /*
   * Invalidate any previous unused tokens for this user
   * before inserting the new one. Only one active token
   * at a time.
   */
  await db
    .delete(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.userId, user.id),
        isNull(emailVerificationTokens.usedAt)
      )
    );

  await db.insert(emailVerificationTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  /* ---------- Send the email ---------- */

  let emailSent = false;
  let emailError: unknown = null;

  try {
    emailSent = await sendVerificationEmail({
      to: user.email,
      name: user.name,
      token: rawToken,
    });
  } catch (err) {
    emailError = err;
  }

  if (!emailSent) {
    console.error(
      "[send-verification-email] failed to send",
      { userId: user.id, error: emailError }
    );

    return NextResponse.json(
      {
        error:
          "Unable to send the verification email. Please try again.",
      },
      { status: 500 }
    );
  }

  console.log("[send-verification-email] sent", {
    userId: user.id,
    email: user.email,
  });

  return NextResponse.json({ success: true });
}