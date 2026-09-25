// app/api/subscription/cancel/route.ts

import { NextResponse } from "next/server";
import { and, desc, eq, gt, inArray } from "drizzle-orm";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import { subscriptions } from "@/app/db/schema";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "@/app/lib/subscription";
import { disablePaystackSubscription } from "@/app/lib/paystack";
import {
  logAuditEvent,
  getAuditIp,
  getAuditUserAgent,
} from "@/app/lib/audit-log";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  /* ---------- Audit context ---------- */

  const ip = getAuditIp(request) ?? "unknown";
  const userAgent = getAuditUserAgent(request);

  /* ---------- Find the current active subscription ---------- */

  const now = new Date();

  const [subscription] = await db
    .select()
    .from(subscriptions)
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

  if (!subscription) {
    return NextResponse.json(
      { error: "No active subscription to cancel." },
      { status: 400 }
    );
  }

  if (subscription.status === "non_renewing") {
    return NextResponse.json(
      { error: "This subscription is already cancelled." },
      { status: 400 }
    );
  }

  /* ---------- Tell Paystack to stop charging ---------- */

  /*
   * We only call Paystack if both codes are present. If the
   * subscription was created without a Paystack link (manual
   * activation, test data, etc.), we skip the call — the
   * local state change still works.
   *
   * If Paystack fails, we DO NOT cancel locally. That would
   * leave the user being charged by Paystack while your app
   * says "non-renewing" — the exact mismatch we're trying to
   * avoid.
   */
  if (
    subscription.paystackSubscriptionCode &&
    subscription.paystackEmailToken
  ) {
    const result = await disablePaystackSubscription({
      subscriptionCode: subscription.paystackSubscriptionCode,
      emailToken: subscription.paystackEmailToken,
    });

    if (!result.success) {
      console.error(
        "[subscription/cancel] Paystack disable failed",
        {
          subscriptionId: subscription.id,
          error: result.error,
        }
      );

      return NextResponse.json(
        {
          error:
            "We couldn't cancel your subscription with our payment provider. Please try again or contact support.",
        },
        { status: 500 }
      );
    }
  } else {
    console.warn(
      "[subscription/cancel] no Paystack codes on record; cancelling locally only",
      { subscriptionId: subscription.id }
    );
  }

  /* ---------- Mark as non-renewing ---------- */

  const cancelledAt = new Date();

  await db
    .update(subscriptions)
    .set({
      status: "non_renewing",
      cancelledAt,
      updatedAt: cancelledAt,
    })
    .where(eq(subscriptions.id, subscription.id));

  /* ---------- Audit log ---------- */

  /*
   * Fire after the DB write. The subscription is now in
   * non_renewing state; if the update had failed, we must
   * not log a cancellation.
   *
   * Severity is "info" — cancellations are a normal
   * business event, not a security signal. Higher severity
   * would flood the critical tier with routine churn.
   */
  await logAuditEvent({
    userId: user.id,
    eventType: "billing.subscription.cancelled",
    severity: "info",
    ipAddress: ip,
    userAgent,
    metadata: {
      subscriptionId: subscription.id,
      planId: subscription.planId,
      accessEndsAt: subscription.endsAt.toISOString(),
      cancelledAt: cancelledAt.toISOString(),
    },
  });

  return NextResponse.json({
    success: true,
    endsAt: subscription.endsAt.toISOString(),
  });
}