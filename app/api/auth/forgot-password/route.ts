import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { eq } from "drizzle-orm";

import { sendResetPasswordEmail } from "@/app/lib/email/send";

import { db } from "@/app/db";
import { users, passwordResetTokens } from "@/app/db/schema";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    if (!email) {
      return NextResponse.json(
        { error: "Email address is required." },
        { status: 400 }
      );
    }

    const result = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    /*
     * Always return the same response whether or not the
     * account exists. Prevents account enumeration.
     */
    if (result.length === 0) {
      return NextResponse.json({ success: true });
    }

    const user = result[0];

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

    /*
     * Invalidate any previous reset tokens for this user
     * before inserting a new one. Without this, an old
     * (unused) link keeps working after a new request.
     */
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    /*
     * Send the email. A failure here does NOT fail the
     * request — the user will just retry.
     */
    try {
      await sendResetPasswordEmail({
        to: user.email,
        name: user.name,
        token: rawToken,
      });
    } catch (emailError) {
      console.error(
        "[forgot-password] email send failed:",
        emailError
      );
    }

    /*
     * Dev convenience: log the raw token so you can test the
     * flow without a working email provider.
     */
    if (process.env.NODE_ENV !== "production") {
      console.log("PASSWORD RESET TOKEN:", rawToken);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Forgot password error:", error);

    return NextResponse.json(
      { error: "Unable to process your request." },
      { status: 500 }
    );
  }
}