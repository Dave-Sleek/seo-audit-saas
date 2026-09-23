import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { sendWelcomeEmail } from "@/app/lib/email/send";

import { db } from "@/app/db";
import { users } from "@/app/db/schema";

import {
  createSession,
  hashPassword,
} from "@/app/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string" ? body.password : "";

    /* ---------- Validation ---------- */

    if (!name) {
      return NextResponse.json(
        { error: "Please enter your name." },
        { status: 400 }
      );
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    /* ---------- Check for existing account ---------- */

    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    /* ---------- Create user ---------- */

    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
      });

    if (!user) {
      throw new Error("User insert returned no row.");
    }

    /* ---------- Create session ---------- */

    await createSession(user.id);

    /* ---------- Send welcome email (non-blocking) ----------
     *
     * Fires AFTER the user and session are committed. Failures
     * are logged but never propagate — a broken email provider
     * must not fail a signup.
     */
    try {
      await sendWelcomeEmail({
        to: user.email,
        name: user.name,
      });
    } catch (emailError) {
      console.error(
        "[signup] welcome email failed:",
        emailError
      );
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Registration error:", error);

    return NextResponse.json(
      { error: "Unable to create your account." },
      { status: 500 }
    );
  }
}