import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/app/db";
import {
  users,
} from "@/app/db/schema";

import {
  createSession,
  verifyPassword,
} from "@/app/lib/auth";

export async function POST(
  request: Request
) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!email || !password) {
      return NextResponse.json(
        {
          error:
            "Email and password are required.",
        },
        { status: 400 }
      );
    }

    const result =
      await db
        .select()
        .from(users)
        .where(
          eq(users.email, email)
        )
        .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        {
          error:
            "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    const user = result[0];

    const valid =
      verifyPassword(
        password,
        user.passwordHash
      );

    if (!valid) {
      return NextResponse.json(
        {
          error:
            "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    await createSession(user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to sign you in.",
      },
      { status: 500 }
    );
  }
}