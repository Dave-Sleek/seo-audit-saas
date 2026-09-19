import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { and, eq } from "drizzle-orm";

import { db } from "@/app/db";

import {
  users,
  sessions,
  passwordResetTokens,
} from "@/app/db/schema";

import { hashPassword } from "@/app/lib/auth";

function hashToken(token: string) {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export async function POST(
  request: Request
) {
  try {
    const body = await request.json();

    const token =
      typeof body.token === "string"
        ? body.token
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!token) {
      return NextResponse.json(
        {
          error:
            "Invalid reset token.",
        },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters.",
        },
        { status: 400 }
      );
    }

    const tokenHash =
      hashToken(token);

    const result =
      await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(
              passwordResetTokens.tokenHash,
              tokenHash
            ),
            eq(
              passwordResetTokens.usedAt,
              null
            )
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

    if (
      resetToken.expiresAt <=
      new Date()
    ) {
      return NextResponse.json(
        {
          error:
            "This reset link has expired.",
        },
        { status: 400 }
      );
    }

    const passwordHash =
      hashPassword(password);

    await db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(
        eq(
          users.id,
          resetToken.userId
        )
      );

    await db
      .update(passwordResetTokens)
      .set({
        usedAt: new Date(),
      })
      .where(
        eq(
          passwordResetTokens.id,
          resetToken.id
        )
      );

    /*
     * Invalidate existing sessions so that
     * changing a password signs the user out
     * from other devices.
     */
    await db
      .delete(sessions)
      .where(
        eq(
          sessions.userId,
          resetToken.userId
        )
      );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Reset password error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to reset your password.",
      },
      { status: 500 }
    );
  }
}