import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { generateSecret, generateURI } from "otplib"; // Updated import
import QRCode from "qrcode";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import { users } from "@/app/db/schema";
import { encrypt } from "@/app/lib/crypto";

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

  /* ---------- Generate secret + QR ---------- */

  const secret = generateSecret(); // v13 API
  const issuer = "SEO Audit";
  const otpauth = generateURI({ // v13 API
    issuer,
    label: user.email,
    secret,
  });

  const qrCode = await QRCode.toDataURL(otpauth);

  /* ---------- Store the secret, encrypted ---------- */

  await db
    .update(users)
    .set({
      twoFactorSecret: encrypt(secret),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return NextResponse.json({
    secret,
    qrCode,
    otpauth,
  });
}