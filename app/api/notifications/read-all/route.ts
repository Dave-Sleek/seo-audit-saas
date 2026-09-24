import { NextResponse } from "next/server";

import { getCurrentUser } from "@/app/lib/auth";
import { markAllAsRead } from "@/app/lib/notifications";

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  await markAllAsRead(user.id);

  return NextResponse.json({ success: true });
}