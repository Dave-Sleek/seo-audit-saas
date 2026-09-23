// app/api/account/2fa/disable/route.ts

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";

import { getCurrentUser, verifyPassword } from "@/app/lib/auth";
import { db } from "@/app/db";
import { users, twoFactorRecoveryCodes } from "@/app/db/schema";

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
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!password || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "Password and 6-digit code are required." },
      { status: 400 }
    );
  }

  /* ---------- Load fresh user ---------- */

  const [freshUser] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      twoFactorEnabledAt: users.twoFactorEnabledAt,
      twoFactorEmailCodeHash: users.twoFactorEmailCodeHash,
      twoFactorEmailCodeExpiresAt: users.twoFactorEmailCodeExpiresAt,
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

  /* ---------- Verify the code ---------- */

  if (!freshUser.twoFactorEmailCodeHash) {
    return NextResponse.json(
      { error: "No verification code was requested." },
      { status: 400 }
    );
  }

  if (
    !freshUser.twoFactorEmailCodeExpiresAt ||
    freshUser.twoFactorEmailCodeExpiresAt < new Date()
  ) {
    return NextResponse.json(
      { error: "This code has expired. Request a new one." },
      { status: 400 }
    );
  }

  if (hashCode(code) !== freshUser.twoFactorEmailCodeHash) {
    return NextResponse.json(
      { error: "Invalid code." },
      { status: 401 }
    );
  }

  /* ---------- Disable 2FA ---------- */

  await db.transaction(async (tx) => {
    await tx
      .delete(twoFactorRecoveryCodes)
      .where(eq(twoFactorRecoveryCodes.userId, user.id));

    await tx
      .update(users)
      .set({
        twoFactorEnabledAt: null,
        twoFactorMethod: null,
        twoFactorSecret: null,
        twoFactorEmailCodeHash: null,
        twoFactorEmailCodeExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
  });

  return NextResponse.json({ success: true });
}