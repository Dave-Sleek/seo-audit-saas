import { NextResponse } from "next/server";
import { desc, ilike, or, eq } from "drizzle-orm";

import { db } from "@/app/db";
import { users, subscriptions, plans } from "@/app/db/schema";
import { getCurrentUser } from "@/app/lib/auth";

/* =========================================================
   AUTH GUARD
========================================================= */

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

  return null;
}

/* =========================================================
   GET /api/admin/users
   Optional query: ?q=search&role=admin&status=active
========================================================= */

export async function GET(request: Request) {
  try {
    const authError = await checkAdmin();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const roleFilter = searchParams.get("role")?.trim() ?? "";

    /* ---------- Base query ---------- */
    let query = db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        emailVerifiedAt: users.emailVerifiedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .$dynamic();

    /* ---------- Search ---------- */
    if (q) {
      query = query.where(
        or(
          ilike(users.name, `%${q}%`),
          ilike(users.email, `%${q}%`)
        )
      );
    }

    /* ---------- Role filter ---------- */
    if (roleFilter === "admin" || roleFilter === "user") {
      query = query.where(eq(users.role, roleFilter));
    }

    /* ---------- Order ---------- */
    const rows = await query.orderBy(desc(users.createdAt)).limit(500);

    /* ---------- Attach subscription info ---------- */
    const userIds = rows.map((r) => r.id);

    let subscriptionMap = new Map<
      string,
      { planName: string; status: string; endsAt: Date }
    >();

    if (userIds.length > 0) {
      // Fetch subscriptions for all listed users
      const subs = await db
        .select({
          userId: subscriptions.userId,
          planName: plans.name,
          status: subscriptions.status,
          endsAt: subscriptions.endsAt,
        })
        .from(subscriptions)
        .innerJoin(plans, eq(subscriptions.planId, plans.id));

      subscriptionMap = new Map(
        subs
          .filter((s) => userIds.includes(s.userId))
          .map((s) => [
            s.userId,
            {
              planName: s.planName,
              status: s.status,
              endsAt: s.endsAt,
            },
          ])
      );
    }

    const enriched = rows.map((r) => ({
      ...r,
      subscription: subscriptionMap.get(r.id) ?? null,
    }));

    return NextResponse.json({ success: true, users: enriched });
  } catch (error) {
    console.error("Admin users GET error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load users.",
      },
      { status: 500 }
    );
  }
}