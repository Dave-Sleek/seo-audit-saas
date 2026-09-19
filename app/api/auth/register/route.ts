import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/app/db";
import {
  users,
} from "@/app/db/schema";

import {
  createSession,
  hashPassword,
} from "@/app/lib/auth";

export async function POST(
  request: Request
) {
  try {
    const body = await request.json();

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!name) {
      return NextResponse.json(
        {
          error:
            "Please enter your name.",
        },
        { status: 400 }
      );
    }

    if (
      !email ||
      !email.includes("@")
    ) {
      return NextResponse.json(
        {
          error:
            "Please enter a valid email address.",
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

    const existingUser =
      await db
        .select({
          id: users.id,
        })
        .from(users)
        .where(
          eq(users.email, email)
        )
        .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        {
          error:
            "An account with this email already exists.",
        },
        { status: 409 }
      );
    }

    const passwordHash =
      hashPassword(password);

    const [user] =
      await db
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

    await createSession(user.id);

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error(
      "Registration error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to create your account.",
      },
      { status: 500 }
    );
  }
}