// app/api/account/2fa/disable/init/route.ts

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { randomInt, createHash } from "crypto";

import { getCurrentUser, verifyPassword } from "@/app/lib/auth";
import { db } from "@/app/db";
import { users } from "@/app/db/schema";
import { sendTwoFactorCodeEmail } from "@/app/lib/email/send";

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const password =
    typeof body?.password === "string" ? body.password : "";

  if (!password) {
    return NextResponse.json(
      { error: "Password is required." },
      { status: 400 }
    );
  }

  /* ---------- Load fresh user ---------- */

  const [freshUser] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      passwordHash: users.passwordHash,
      twoFactorEnabledAt: users.twoFactorEnabledAt,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!freshUser) {
    return NextResponse.json(
      { error: "User not found." },
      { status: 404 }
    );
  }

  if (!freshUser.twoFactorEnabledAt) {
    return NextResponse.json(
      { error: "Two-factor authentication is not enabled." },
      { status: 400 }
    );
  }

  /* ---------- Verify password ---------- */

  const passwordValid = await verifyPassword(
    password,
    freshUser.passwordHash
  );

  if (!passwordValid) {
    return NextResponse.json(
      { error: "Incorrect password." },
      { status: 401 }
    );
  }

  /* ---------- Generate + store code ---------- */

  const code = String(randomInt(100000, 999999));
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await db
    .update(users)
    .set({
      twoFactorEmailCodeHash: codeHash,
      twoFactorEmailCodeExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  /* ---------- Send email ---------- */

  let emailSent = false;
  let emailError: unknown = null;

  try {
    emailSent = await sendTwoFactorCodeEmail({
      to: freshUser.email,
      name: freshUser.name,
      code,
    });
  } catch (err) {
    emailError = err;
  }

  if (!emailSent) {
    console.error("[2fa/disable/init] email send failed", {
      userId: user.id,
      error: emailError,
    });

    return NextResponse.json(
      {
        error:
          "Unable to send the verification code. Please try again.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}