import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { eq } from "drizzle-orm";

import { db } from "@/app/db";
import {
  users,
  passwordResetTokens,
} from "@/app/db/schema";

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

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    if (!email) {
      return NextResponse.json(
        {
          error:
            "Email address is required.",
        },
        { status: 400 }
      );
    }

    const result =
      await db
        .select({
          id: users.id,
        })
        .from(users)
        .where(
          eq(users.email, email)
        )
        .limit(1);

    /*
     * Always return the same response whether
     * or not the email exists. This prevents
     * account enumeration.
     */
    if (result.length === 0) {
      return NextResponse.json({
        success: true,
      });
    }

    const user = result[0];

    const rawToken =
      randomBytes(32).toString("hex");

    const tokenHash =
      hashToken(rawToken);

    const expiresAt =
      new Date(
        Date.now() +
          1000 * 60 * 60
      );

    await db
      .insert(passwordResetTokens)
      .values({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

    /*
     * Email delivery will be connected here.
     *
     * Example future URL:
     *
     * https://yourdomain.com/reset-password?token=...
     */

    if (process.env.NODE_ENV !== "production") {
      console.log(
        "PASSWORD RESET TOKEN:",
        rawToken
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Forgot password error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to process your request.",
      },
      { status: 500 }
    );
  }
}