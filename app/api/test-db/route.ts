import { NextResponse } from "next/server";
import { db } from "@/app/db";
import { projects } from "@/app/db/schema";

export async function GET() {
  try {
    const result = await db.select().from(projects);

    return NextResponse.json({
      success: true,
      projects: result,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Database connection failed",
      },
      { status: 500 }
    );
  }
}