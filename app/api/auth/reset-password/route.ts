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
    /* ---------- Read body ---------- */

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

    /* ---------- Validate input ---------- */

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

    /* ---------- Look up unused token ---------- */

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

    /* ---------- Check expiry ---------- */

    if (resetToken.expiresAt <= new Date()) {
      return NextResponse.json(
        { error: "This reset link has expired." },
        { status: 400 }
      );
    }

    /* ---------- Hash new password ---------- */

    const passwordHash = await hashPassword(password);

    /* ---------- Update user password ---------- */

    await db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, resetToken.userId));

    /* ---------- Mark token as used ---------- */

    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, resetToken.id));

    /* ---------- Invalidate existing sessions ---------- */

    /*
     * Changing a password signs the user out from every device.
     * This prevents an attacker with a stolen session from
     * remaining logged in after a password reset.
     */
    await db
      .delete(sessions)
      .where(eq(sessions.userId, resetToken.userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);

    return NextResponse.json(
      { error: "Unable to reset your password." },
      { status: 500 }
    );
  }
}