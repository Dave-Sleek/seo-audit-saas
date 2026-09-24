import { NextResponse } from "next/server";

import { getCurrentUser } from "@/app/lib/auth";
import { markAsRead } from "@/app/lib/notifications";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  await markAsRead(user.id, id);

  return NextResponse.json({ success: true });
}