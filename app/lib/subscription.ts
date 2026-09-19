import {
  and,
  desc,
  eq,
  gt,
  inArray,
  lte,
  sql,
} from "drizzle-orm";

import { db } from "@/app/db";
import {
  payments,
  plans,
  subscriptionUsage,
  subscriptions,
} from "@/app/db/schema";

/*
 * ---------------------------------------------------------
 * Subscription statuses considered currently active.
 * ---------------------------------------------------------
 */

export const ACTIVE_SUBSCRIPTION_STATUSES = [
  "active",
  "non_renewing",
] as const;

/*
 * ---------------------------------------------------------
 * Get a plan by ID
 * ---------------------------------------------------------
 */

export async function getPlanById(planId: string) {
  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, planId))
    .limit(1);

  return plan ?? null;
}

/*
 * ---------------------------------------------------------
 * Expire expired subscriptions for one user
 * ---------------------------------------------------------
 */

export async function expireUserSubscriptions(
  userId: string
): Promise<void> {
  const now = new Date();

  await db
    .update(subscriptions)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(subscriptions.status, ACTIVE_SUBSCRIPTION_STATUSES),
        lte(subscriptions.endsAt, now)
      )
    );
}

/*
 * ---------------------------------------------------------
 * Expire all subscriptions whose end date has passed.
 * Can be called by a cron job.
 * ---------------------------------------------------------
 */

export async function expireExpiredSubscriptions(): Promise<void> {
  const now = new Date();

  await db
    .update(subscriptions)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        inArray(subscriptions.status, ACTIVE_SUBSCRIPTION_STATUSES),
        lte(subscriptions.endsAt, now)
      )
    );
}

/*
 * ---------------------------------------------------------
 * Get active subscription for a user
 * ---------------------------------------------------------
 */

export async function getActiveSubscription(userId: string) {
  const now = new Date();

  // First expire anything that's already ended.
  await expireUserSubscriptions(userId);

  const [subscription] = await db
    .select({
      subscription: subscriptions,
      plan: plans,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(subscriptions.status, ACTIVE_SUBSCRIPTION_STATUSES),
        gt(subscriptions.endsAt, now)
      )
    )
    .orderBy(desc(subscriptions.endsAt))
    .limit(1);

  if (!subscription) {
    return null;
  }

  return subscription;
}

/*
 * ---------------------------------------------------------
 * Get user's subscription
 * ---------------------------------------------------------
 */

export async function getUserSubscription(userId: string) {
  const result = await getActiveSubscription(userId);
  return result?.subscription ?? null;
}

/*
 * ---------------------------------------------------------
 * Calculate subscription end date
 * ---------------------------------------------------------
 */

export function calculateEndDate(
  startDate: Date,
  interval: string
): Date {
  const endDate = new Date(startDate);

  switch (interval.toLowerCase()) {
    case "daily":
      endDate.setDate(endDate.getDate() + 1);
      break;

    case "weekly":
      endDate.setDate(endDate.getDate() + 7);
      break;

    case "monthly":
      endDate.setMonth(endDate.getMonth() + 1);
      break;

    case "quarterly":
      endDate.setMonth(endDate.getMonth() + 3);
      break;

    case "biannual":
    case "semiannual":
      endDate.setMonth(endDate.getMonth() + 6);
      break;

    case "annual":
    case "yearly":
      endDate.setFullYear(endDate.getFullYear() + 1);
      break;

    default:
      endDate.setMonth(endDate.getMonth() + 1);
      break;
  }

  return endDate;
}

/*
 * ---------------------------------------------------------
 * Create usage period
 * ---------------------------------------------------------
 */

async function createUsagePeriod(
  tx: Parameters<
    Parameters<typeof db.transaction>[0]
  >[0],
  subscriptionId: string,
  userId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<void> {
  await tx
    .insert(subscriptionUsage)
    .values({
      subscriptionId,
      userId,
      periodStart,
      periodEnd,
    })
    .onConflictDoNothing({
      target: [
        subscriptionUsage.subscriptionId,
        subscriptionUsage.periodStart,
        subscriptionUsage.periodEnd,
      ],
    });
}

/*
 * ---------------------------------------------------------
 * Extract plan ID from a payment row.
 *
 * The payments table does not have a plan_id column, so
 * the plan is stored inside metadata.planId.
 *
 * Throws if the plan ID is missing — callers do not need to
 * check for null and TypeScript is able to narrow the type
 * to `string` after the call.
 * ---------------------------------------------------------
 */

function extractPlanIdFromPayment(
  payment: typeof payments.$inferSelect
): string {
  const metadata = payment.metadata as
    | { planId?: string }
    | null
    | undefined;

  if (!metadata || typeof metadata !== "object") {
    throw new Error("PAYMENT_MISSING_PLAN_METADATA");
  }

  if (typeof metadata.planId !== "string") {
    throw new Error("PAYMENT_MISSING_PLAN_METADATA");
  }

  return metadata.planId;
}

/*
 * ---------------------------------------------------------
 * Activate subscription
 * ---------------------------------------------------------
 *
 * Idempotent and concurrency-safe.
 *
 * Callback and webhook can arrive at the same time.
 * We lock the payment row inside the transaction
 * (SELECT ... FOR UPDATE) so only one creates the subscription.
 * ---------------------------------------------------------
 */

export async function activateSubscription({
  paymentId,
  userId,
}: {
  paymentId: string;
  userId: string;
}) {
  return await db.transaction(async (tx) => {
    /*
     * -------------------------------------------------------
     * 1. Lock payment row
     * -------------------------------------------------------
     */

    const lockedPayments = await tx
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.id, paymentId),
          eq(payments.userId, userId)
        )
      )
      .for("update");

    const payment = lockedPayments[0];

    if (!payment) {
      throw new Error("PAYMENT_NOT_FOUND");
    }

    /*
     * -------------------------------------------------------
     * 2. Already activated?
     * -------------------------------------------------------
     */

    if (payment.subscriptionId) {
      const [existingSubscription] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, payment.subscriptionId))
        .limit(1);

      if (existingSubscription) {
        return existingSubscription;
      }

      throw new Error(
        "PAYMENT_SUBSCRIPTION_REFERENCE_INVALID"
      );
    }

    /*
     * -------------------------------------------------------
     * 3. Payment must be successful
     *
     * DB check constraint allows:
     *   pending | successful | failed | refunded
     * -------------------------------------------------------
     */

    if (payment.status !== "successful") {
      throw new Error("PAYMENT_NOT_SUCCESSFUL");
    }

    /*
     * -------------------------------------------------------
     * 4. Extract plan ID from metadata
     *
     * Throws PAYMENT_MISSING_PLAN_METADATA if missing.
     * Returns a non-null string otherwise.
     * -------------------------------------------------------
     */

    const planId = extractPlanIdFromPayment(payment);

    /*
     * -------------------------------------------------------
     * 5. Load plan
     * -------------------------------------------------------
     */

    const [plan] = await tx
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1);

    if (!plan) {
      throw new Error("PLAN_NOT_FOUND");
    }

    if (!plan.isActive) {
      throw new Error("PLAN_NOT_ACTIVE");
    }

    /*
     * -------------------------------------------------------
     * 6. Validate payment amount matches plan price
     * -------------------------------------------------------
     *
     * payment.amount is numeric(12,2) — comes back as a string
     * plan.price is integer (kobo)
     *
     * Normalize both to integers before comparing.
     * -------------------------------------------------------
     */

    const paymentAmount = Math.round(Number(payment.amount));
    const planPrice = Math.round(Number(plan.price));

    if (paymentAmount !== planPrice) {
      throw new Error("PAYMENT_PLAN_AMOUNT_MISMATCH");
    }

    /*
     * -------------------------------------------------------
     * 7. Expire old subscriptions
     * -------------------------------------------------------
     */

    const now = new Date();

    await tx
      .update(subscriptions)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(subscriptions.userId, userId),
          inArray(subscriptions.status, ACTIVE_SUBSCRIPTION_STATUSES),
          lte(subscriptions.endsAt, now)
        )
      );

    /*
     * -------------------------------------------------------
     * 8. Find existing active subscription (for stacking)
     * -------------------------------------------------------
     */

    const [existingActiveSubscription] = await tx
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          inArray(subscriptions.status, ACTIVE_SUBSCRIPTION_STATUSES),
          gt(subscriptions.endsAt, now)
        )
      )
      .orderBy(desc(subscriptions.endsAt))
      .limit(1);

    /*
     * -------------------------------------------------------
     * 9. Determine start date
     *
     * If user already has an active subscription, the new
     * one stacks on top of it.
     * -------------------------------------------------------
     */

    const startsAt = existingActiveSubscription
      ? new Date(existingActiveSubscription.endsAt)
      : now;

    const endsAt = calculateEndDate(startsAt, plan.interval);

    /*
     * -------------------------------------------------------
     * 10. Create subscription
     * -------------------------------------------------------
     */

    const [newSubscription] = await tx
      .insert(subscriptions)
      .values({
        userId,
        planId: plan.id,
        status: "active",
        startsAt,
        endsAt,
      })
      .returning();

    if (!newSubscription) {
      throw new Error("SUBSCRIPTION_CREATION_FAILED");
    }

    /*
     * -------------------------------------------------------
     * 11. Create usage period for the new subscription
     * -------------------------------------------------------
     */

    await createUsagePeriod(
      tx,
      newSubscription.id,
      userId,
      startsAt,
      endsAt
    );

    /*
     * -------------------------------------------------------
     * 12. Link payment to subscription
     * -------------------------------------------------------
     */

    const [linkedPayment] = await tx
      .update(payments)
      .set({
        subscriptionId: newSubscription.id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(payments.id, payment.id),
          eq(payments.userId, userId),
          sql`${payments.subscriptionId} IS NULL`
        )
      )
      .returning();

    if (!linkedPayment) {
      throw new Error("PAYMENT_ALREADY_LINKED");
    }

    return newSubscription;
  });
}

/*
 * ---------------------------------------------------------
 * Cancel subscription locally
 *
 * Does not cancel the Paystack recurring profile yet.
 * ---------------------------------------------------------
 */

export async function cancelSubscription(userId: string) {
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active")
      )
    )
    .orderBy(desc(subscriptions.endsAt))
    .limit(1);

  if (!subscription) {
    return null;
  }

  const [updatedSubscription] = await db
    .update(subscriptions)
    .set({
      status: "non_renewing",
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscription.id))
    .returning();

  return updatedSubscription ?? null;
}

/*
 * ---------------------------------------------------------
 * Get current plan
 * ---------------------------------------------------------
 */

export async function getCurrentPlan(userId: string) {
  const activeSubscription = await getActiveSubscription(userId);
  return activeSubscription?.plan ?? null;
}

/*
 * ---------------------------------------------------------
 * Check whether user has active subscription
 * ---------------------------------------------------------
 */

export async function hasActiveSubscription(
  userId: string
): Promise<boolean> {
  const activeSubscription = await getActiveSubscription(userId);
  return Boolean(activeSubscription);
}