// app/api/account/2fa/email/enroll/route.ts

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { randomInt, createHash } from "crypto";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import { users } from "@/app/db/schema";
import { sendTwoFactorCodeEmail } from "@/app/lib/email/send";

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function POST() {
  /* ---------- Auth ---------- */

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  /* ---------- Refuse if already enabled ---------- */

  if (user.twoFactorEnabledAt) {
    return NextResponse.json(
      { error: "Two-factor authentication is already enabled." },
      { status: 400 }
    );
  }

  /* ---------- Generate code ---------- */

  const code = String(randomInt(100000, 999999));
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  /* ---------- Store hash + expiry ---------- */

  await db
    .update(users)
    .set({
      twoFactorEmailCodeHash: codeHash,
      twoFactorEmailCodeExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  /* ---------- Send email ---------- */

  /*
   * A failed send must not fail the request — the user can
   * click "Resend code" on the verify dialog. Log it so you
   * can spot Resend misconfiguration.
   */
  try {
    await sendTwoFactorCodeEmail({
      to: user.email,
      name: user.name,
      code,
    });
  } catch (err) {
    console.error("[2fa/email/enroll] send failed:", err);
  }

  return NextResponse.json({ success: true });
}