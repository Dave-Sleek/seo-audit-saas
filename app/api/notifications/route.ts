import { NextResponse } from "next/server";

import { getCurrentUser } from "@/app/lib/auth";
import {
  countUnread,
  listNotifications,
} from "@/app/lib/notifications";

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(
    Math.max(Number(limitParam) || 20, 1),
    100
  );

  const [items, unread] = await Promise.all([
    listNotifications(user.id, limit),
    countUnread(user.id),
  ]);

  return NextResponse.json({
    notifications: items,
    unread,
  });
}