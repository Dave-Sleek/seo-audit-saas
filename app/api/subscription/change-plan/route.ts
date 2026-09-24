// app/api/subscription/change-plan/route.ts

import { NextResponse } from "next/server";
import { and, desc, eq, gt, inArray } from "drizzle-orm";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import {
  plans,
  subscriptions,
} from "@/app/db/schema";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "@/app/lib/subscription";

export async function POST(request: Request) {
  /* ---------- Auth ---------- */

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  /* ---------- Parse body ---------- */

  const body = await request.json().catch(() => null);
  const newPlanId =
    typeof body?.planId === "string" ? body.planId : "";

  if (!newPlanId) {
    return NextResponse.json(
      { error: "planId is required." },
      { status: 400 }
    );
  }

  /* ---------- Load the target plan ---------- */

  const [newPlan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, newPlanId))
    .limit(1);

  if (!newPlan || !newPlan.isActive) {
    return NextResponse.json(
      { error: "Plan not found or inactive." },
      { status: 404 }
    );
  }

  /* ---------- Load the user's active subscription + plan ---------- */

  const now = new Date();

  const [row] = await db
    .select({
      subscription: subscriptions,
      plan: plans,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(
      and(
        eq(subscriptions.userId, user.id),
        inArray(
          subscriptions.status,
          ACTIVE_SUBSCRIPTION_STATUSES
        ),
        gt(subscriptions.endsAt, now)
      )
    )
    .orderBy(desc(subscriptions.endsAt))
    .limit(1);

  if (!row) {
    return NextResponse.json(
      { error: "No active subscription to change." },
      { status: 400 }
    );
  }

  const { subscription, plan: currentPlan } = row;

  /* ---------- Sanity: same plan ---------- */

  if (subscription.planId === newPlanId) {
    return NextResponse.json(
      { error: "You're already on this plan." },
      { status: 400 }
    );
  }

  /* ---------- Decide: upgrade or downgrade ---------- */

  /*
   * Compare the *effective daily rate* of each plan rather
   * than the raw price. This handles interval mismatches:
   * a ₦50,000/year plan is cheaper per day than a ₦5,000/month
   * plan, so switching from yearly to monthly is an *upgrade*
   * even though the annual price is higher.
   */
  const currentDaily =
    Number(currentPlan.price) /
    daysInInterval(currentPlan.interval);

  const newDaily =
    Number(newPlan.price) / daysInInterval(newPlan.interval);

  const isUpgrade = newDaily > currentDaily;

  /* ---------- Upgrade: hand off to checkout ---------- */

  if (isUpgrade) {
    console.log("[change-plan] upgrade requested", {
      userId: user.id,
      subscriptionId: subscription.id,
      currentPlanId: currentPlan.id,
      newPlanId: newPlan.id,
    });

    return NextResponse.json({
      action: "checkout",
      planId: newPlan.id,
      planSlug: newPlan.slug,
      planName: newPlan.name,
    });
  }

  /* ---------- Downgrade: not supported as self-service ---------- */

  /*
   * Paystack doesn't offer a clean API to change a
   * subscription's plan mid-cycle. Doing it properly would
   * require a user-approved checkout at the new price, which
   * is exactly what "cancel and resubscribe" achieves.
   *
   * So we block downgrades here with a clear message. The
   * modal shows the same explanation to the user, but this
   * route is the authoritative source of truth — any client
   * that calls it directly gets a correct error.
   */
  return NextResponse.json(
    {
      error:
        "To switch to a lower plan, cancel your current subscription and resubscribe when your period ends.",
      code: "DOWNGRADE_NOT_SUPPORTED",
    },
    { status: 400 }
  );
}

/* =========================================================
   HELPERS
========================================================= */

function daysInInterval(interval: string): number {
  switch (interval.toLowerCase()) {
    case "daily":
      return 1;
    case "weekly":
      return 7;
    case "monthly":
      return 30;
    case "quarterly":
      return 90;
    case "biannual":
    case "semiannual":
      return 180;
    case "annual":
    case "yearly":
      return 365;
    default:
      return 30;
  }
}