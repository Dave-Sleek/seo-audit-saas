import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

import { db } from "@/app/db";
import { users, passwordResetTokens } from "@/app/db/schema";
import { getCurrentUser } from "@/app/lib/auth";

async function checkAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  if (user.role !== "admin") {
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  return user;
}

/**
 * POST /api/admin/users/:id/password
 *
 * Two modes:
 *   { mode: "reset-link" }  → generates a password reset token, returns URL
 *   { mode: "set", password: "..." } → directly sets a new password
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdmin();
    if (admin instanceof NextResponse) return admin;

    const { id } = await context.params;
    const body = await request.json();
    const mode = body.mode === "set" ? "set" : "reset-link";

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    /* ---------- Mode: generate reset link ---------- */

    if (mode === "reset-link") {
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      const resetUrl = `${
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
      }/reset-password?token=${token}`;

      return NextResponse.json({
        success: true,
        mode: "reset-link",
        resetUrl,
        expiresAt,
      });
    }

    /* ---------- Mode: set password directly ---------- */

    const password = String(body.password ?? "");

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, id));

    // Invalidate existing sessions
    await db.delete(require("@/app/db/schema").sessions).where(
      eq(require("@/app/db/schema").sessions.userId, id)
    );

    return NextResponse.json({
      success: true,
      mode: "set",
      message: "Password updated. Existing sessions were invalidated.",
    });
  } catch (error) {
    console.error("Admin password reset error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to reset password.",
      },
      { status: 500 }
    );
  }
}