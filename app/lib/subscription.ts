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
  projects,
  plans,
  subscriptionUsage,
  subscriptions,
} from "@/app/db/schema";

/* =========================================================
   CONSTANTS
========================================================= */

/**
 * Subscription statuses considered currently active.
 *
 * "non_renewing" means the user has cancelled auto-renewal
 * but still has access until endsAt.
 */
export const ACTIVE_SUBSCRIPTION_STATUSES = [
  "active",
  "non_renewing",
] as const;

/* =========================================================
   INTERNAL HELPERS
========================================================= */

/**
 * Load the currently active subscription + plan for a user.
 *
 * Before querying, marks any past-due subscriptions as
 * expired so they don't appear in the active set.
 */
async function getActiveSubscriptionWithPlan(userId: string) {
  const now = new Date();

  await db
    .update(subscriptions)
    .set({
      status: "expired",
      updatedAt: now,
    })
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active"),
        lte(subscriptions.endsAt, now)
      )
    );

  const result = await db
    .select({
      subscription: subscriptions,
      plan: plans,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(
          subscriptions.status,
          ACTIVE_SUBSCRIPTION_STATUSES
        ),
        lte(subscriptions.startsAt, now),
        gt(subscriptions.endsAt, now)
      )
    )
    .orderBy(sql`${subscriptions.endsAt} DESC`)
    .limit(1);

  return result[0] ?? null;
}

/**
 * Find or create the subscription_usage row for the
 * *current* billing period.
 *
 * We deliberately do NOT match on
 * (subscriptionId, subscription.startsAt, subscription.endsAt)
 * because renewals extend the subscription's endsAt without
 * touching startsAt. That means the exact-match approach
 * stops finding the row after the first renewal.
 *
 * Instead, we find the usage row whose period *contains now*.
 *
 * If no such row exists (first call for a new subscription),
 * we create one using the subscription's initial period.
 */
async function ensureUsagePeriod(
  userId: string,
  subscriptionId: string,
  subscriptionStartsAt: Date,
  subscriptionEndsAt: Date
): Promise<typeof subscriptionUsage.$inferSelect | null> {
  const now = new Date();

  /* ---------- 1. Find the usage row for the current period ---------- */

  const [current] = await db
    .select()
    .from(subscriptionUsage)
    .where(
      and(
        eq(subscriptionUsage.subscriptionId, subscriptionId),
        lte(subscriptionUsage.periodStart, now),
        gt(subscriptionUsage.periodEnd, now)
      )
    )
    .limit(1);

  if (current) {
    return current;
  }

  /* ---------- 2. No current period — create one ---------- */

  const [inserted] = await db
    .insert(subscriptionUsage)
    .values({
      subscriptionId,
      userId,
      periodStart: subscriptionStartsAt,
      periodEnd: subscriptionEndsAt,
      auditsUsed: 0,
      pagesCrawled: 0,
      aiRecommendationsUsed: 0,
    })
    .onConflictDoNothing({
      target: [
        subscriptionUsage.subscriptionId,
        subscriptionUsage.periodStart,
        subscriptionUsage.periodEnd,
      ],
    })
    .returning();

  if (inserted) {
    return inserted;
  }

  /* ---------- 3. Lost the race — re-fetch ---------- */

  const [retry] = await db
    .select()
    .from(subscriptionUsage)
    .where(
      and(
        eq(subscriptionUsage.subscriptionId, subscriptionId),
        lte(subscriptionUsage.periodStart, now),
        gt(subscriptionUsage.periodEnd, now)
      )
    )
    .limit(1);

  return retry ?? null;
}

/**
 * Count active projects for a user.
 */
async function getActiveProjectCount(
  userId: string
): Promise<number> {
  const result = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(projects)
    .where(
      and(
        eq(projects.userId, userId),
        eq(projects.isActive, true)
      )
    );

  return Number(result[0]?.count ?? 0);
}

/**
 * Insert a usage period inside an existing transaction.
 *
 * Used only by activateSubscription, which needs the insert
 * to happen atomically with the subscription creation.
 *
 * Non-transaction callers should use ensureUsagePeriod instead.
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

/**
 * Read the plan ID from a payment's metadata.
 *
 * The payments table has no plan_id column — the plan ID is
 * stored inside metadata.planId when the payment row is
 * created by /api/payments/initialize.
 *
 * Throws if missing. After this call TypeScript knows the
 * returned value is a non-null string.
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

/* =========================================================
   PUBLIC — READS
========================================================= */

/**
 * Get a plan by ID.
 */
export async function getPlanById(planId: string) {
  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, planId))
    .limit(1);

  return plan ?? null;
}

/**
 * Get the user's active subscription + plan, or null.
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
    return null;
  }

  return subscription;
}

/**
 * Get just the subscription row (no joined plan).
 */
export async function getUserSubscription(userId: string) {
  const result = await getActiveSubscription(userId);
  return result?.subscription ?? null;
}

/**
 * Get the user's current plan, or null if not subscribed.
 */
export async function getCurrentPlan(userId: string) {
  const activeSubscription = await getActiveSubscription(userId);
  return activeSubscription?.plan ?? null;
}

/**
 * Whether the user has any active subscription.
 */
export async function hasActiveSubscription(
  userId: string
): Promise<boolean> {
  const activeSubscription = await getActiveSubscription(userId);
  return Boolean(activeSubscription);
}

/* =========================================================
   PUBLIC — EXPIRY
========================================================= */

/**
 * Expire all past-due subscriptions for a single user.
 */
export async function expireUserSubscriptions(
  userId: string
): Promise<void> {
  const now = new Date();

  await db
    .update(subscriptions)
    .set({
      status: "expired",
      updatedAt: now,
    })
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(
          subscriptions.status,
          ACTIVE_SUBSCRIPTION_STATUSES
        ),
        lte(subscriptions.endsAt, now)
      )
    );
}

/**
 * Expire all past-due subscriptions across all users.
 *
 * Intended to be called by a daily cron job. The
 * per-user version above covers the common case where the
 * user just loaded a page; this one sweeps the rest.
 */
export async function expireExpiredSubscriptions(): Promise<void> {
  const now = new Date();

  await db
    .update(subscriptions)
    .set({
      status: "expired",
      updatedAt: now,
    })
    .where(
      and(
        inArray(
          subscriptions.status,
          ACTIVE_SUBSCRIPTION_STATUSES
        ),
        lte(subscriptions.endsAt, now)
      )
    );
}

/* =========================================================
   PUBLIC — DATES
========================================================= */

/**
 * Add one interval to a start date.
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

/* =========================================================
   PUBLIC — ACTIVATION
========================================================= */

/**
 * Activate a subscription from a successful payment.
 *
 * Idempotent and concurrency-safe.
 *
 * The payment row is locked with SELECT ... FOR UPDATE so
 * the callback and the webhook cannot both create a
 * subscription for the same payment.
 *
 * If the user already has an active subscription, the new
 * one stacks on top of it (start date = existing endsAt).
 */
export async function activateSubscription({
  paymentId,
  userId,
}: {
  paymentId: string;
  userId: string;
}) {
  return await db.transaction(async (tx) => {
    /* ---------- 1. Lock payment row ---------- */

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

    /* ---------- 2. Already activated? ---------- */

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

    /* ---------- 3. Payment must be successful ---------- */

    if (payment.status !== "successful") {
      throw new Error("PAYMENT_NOT_SUCCESSFUL");
    }

    /* ---------- 4. Extract plan ID ---------- */

    const planId = extractPlanIdFromPayment(payment);

    /* ---------- 5. Load plan ---------- */

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

    /* ---------- 6. Validate amount matches plan price ---------- */

    const paymentAmount = Math.round(Number(payment.amount));
    const planPrice = Math.round(Number(plan.price));

    if (paymentAmount !== planPrice) {
      throw new Error("PAYMENT_PLAN_AMOUNT_MISMATCH");
    }

    /* ---------- 7. Expire past-due subscriptions ---------- */

    const now = new Date();

    await tx
      .update(subscriptions)
      .set({
        status: "expired",
        updatedAt: now,
      })
      .where(
        and(
          eq(subscriptions.userId, userId),
          inArray(
            subscriptions.status,
            ACTIVE_SUBSCRIPTION_STATUSES
          ),
          lte(subscriptions.endsAt, now)
        )
      );

    /* ---------- 8. Find existing active subscription ---------- */

    const [existingActiveSubscription] = await tx
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          inArray(
            subscriptions.status,
            ACTIVE_SUBSCRIPTION_STATUSES
          ),
          gt(subscriptions.endsAt, now)
        )
      )
      .orderBy(desc(subscriptions.endsAt))
      .limit(1);

    /* ---------- 9. Determine start / end dates ---------- */

    const startsAt = existingActiveSubscription
      ? new Date(existingActiveSubscription.endsAt)
      : now;

    const endsAt = calculateEndDate(startsAt, plan.interval);

    /* ---------- 10. Create subscription ---------- */

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

    /* ---------- 11. Create usage period ---------- */

    await createUsagePeriod(
      tx,
      newSubscription.id,
      userId,
      startsAt,
      endsAt
    );

    /* ---------- 12. Link payment to subscription ---------- */

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

/* =========================================================
   PUBLIC — RENEWAL
========================================================= */

/**
 * Extend a subscription from a renewal charge.
 *
 * Called by the webhook after Paystack confirms a renewal.
 * The subscription already exists — we just push endsAt
 * forward by one interval and create a fresh usage period.
 *
 * Idempotency
 * -----------
 * If a usage row already exists for the computed period, we
 * assume this renewal has already been applied and return
 * early. That makes the function safe to call multiple times
 * for the same renewal (Paystack retries webhooks).
 *
 * Period boundary
 * ---------------
 * The new period's periodStart is offset by 1 millisecond
 * from the previous period's periodEnd. JavaScript Date has
 * millisecond precision, so this is the smallest offset that
 * reliably prevents the two periods from overlapping at the
 * boundary in the "period contains now" query.
 *
 * If the subscription already expired, the new period starts
 * from now instead of the previous endsAt.
 */
export async function extendSubscriptionFromRenewal({
  subscriptionId,
  planInterval,
  renewalReference,
}: {
  subscriptionId: string;
  planInterval: string;
  renewalReference: string;
}): Promise<void> {
  await db.transaction(async (tx) => {
    /* ---------- 1. Lock subscription row ---------- */

    const [subscription] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .for("update");

    if (!subscription) {
      throw new Error(
        "extendSubscriptionFromRenewal: subscription not found"
      );
    }

    /* ---------- 2. Idempotency check by renewal reference ---------- */

    /*
     * If a usage row already carries this renewal reference,
     * the renewal has been applied. Return early.
     *
     * This is the guard that makes repeat webhooks safe.
     * The previous version compared period boundaries, but
     * those shift on every call, so it never matched.
     */
    const [existingRenewal] = await tx
      .select({ id: subscriptionUsage.id })
      .from(subscriptionUsage)
      .where(
        eq(subscriptionUsage.renewalReference, renewalReference)
      )
      .limit(1);

    if (existingRenewal) {
      return;
    }

    /* ---------- 3. Compute new period boundaries ---------- */

    const now = new Date();

    const rawPeriodStart =
      subscription.endsAt > now ? subscription.endsAt : now;

    const periodStart = new Date(
      rawPeriodStart.getTime() + 1
    );

    const periodEnd = calculateEndDate(periodStart, planInterval);

    /* ---------- 4. Extend the subscription ---------- */

    await tx
      .update(subscriptions)
      .set({
        status: "active",
        endsAt: periodEnd,
        cancelledAt: null,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, subscriptionId));

    /* ---------- 5. Create the new usage period ---------- */

    await tx
      .insert(subscriptionUsage)
      .values({
        subscriptionId,
        userId: subscription.userId,
        periodStart,
        periodEnd,
        auditsUsed: 0,
        pagesCrawled: 0,
        aiRecommendationsUsed: 0,
        renewalReference,
      })
      .onConflictDoNothing({
        target: [
          subscriptionUsage.renewalReference,
        ],
      });

    /* ---------- 6. Audit trail ---------- */

    console.log("[subscription] renewed", {
      subscriptionId,
      userId: subscription.userId,
      renewalReference,
      newPeriodStart: periodStart.toISOString(),
      newPeriodEnd: periodEnd.toISOString(),
    });
  });
}

/* =========================================================
   PUBLIC — CANCELLATION
========================================================= */

/**
 * Mark the user's subscription as non-renewing.
 *
 * The user keeps access until endsAt. When that date passes,
 * expireUserSubscriptions (or the cron) will flip the status
 * to "expired".
 *
 * This does NOT cancel the Paystack recurring profile — that
 * requires calling Paystack's subscription disable endpoint
 * with the stored paystack_subscription_code.
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