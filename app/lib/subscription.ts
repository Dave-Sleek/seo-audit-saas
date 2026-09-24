import {
  and,
  asc,
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
   TYPES
========================================================= */

type Subscription = typeof subscriptions.$inferSelect;

/* =========================================================
   CONSTANTS
========================================================= */

export const ACTIVE_SUBSCRIPTION_STATUSES = [
  "active",
  "non_renewing",
] as const;

/* =========================================================
   INTERNAL HELPERS
========================================================= */

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

async function ensureUsagePeriod(
  userId: string,
  subscriptionId: string,
  subscriptionStartsAt: Date,
  subscriptionEndsAt: Date
): Promise<typeof subscriptionUsage.$inferSelect | null> {
  const now = new Date();

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

export async function getPlanById(planId: string) {
  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, planId))
    .limit(1);

  return plan ?? null;
}

export async function getActiveSubscription(userId: string) {
  await maybeExtendFreeSubscription(userId);

  const now = new Date();

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

  return subscription ?? null;
}

export async function getUserSubscription(userId: string) {
  const result = await getActiveSubscription(userId);
  return result?.subscription ?? null;
}

export async function getCurrentPlan(userId: string) {
  const activeSubscription = await getActiveSubscription(userId);
  return activeSubscription?.plan ?? null;
}

export async function hasActiveSubscription(
  userId: string
): Promise<boolean> {
  const activeSubscription = await getActiveSubscription(userId);
  return Boolean(activeSubscription);
}

/* =========================================================
   PUBLIC — EXPIRY
========================================================= */

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

  const [stillActive] = await db
    .select({ id: subscriptions.id })
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
    .limit(1);

  if (!stillActive) {
    await grantFreeSubscription(userId);
  }
}

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
   PUBLIC — FREE PLAN
========================================================= */

export async function getFreePlan() {
  const [plan] = await db
    .select()
    .from(plans)
    .where(
      and(
        eq(plans.price, 0),
        eq(plans.isActive, true)
      )
    )
    .orderBy(asc(plans.createdAt))
    .limit(1);

  return plan ?? null;
}

export async function grantFreeSubscription(
  userId: string
): Promise<void> {
  const freePlan = await getFreePlan();

  if (!freePlan) {
    console.warn(
      "[subscription] no Free plan configured; skipping auto-grant",
      { userId }
    );
    return;
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: subscriptions.id })
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
      .for("update");

    if (existing.length > 0) {
      return;
    }

    const startsAt = now;
    const endsAt = calculateEndDate(
      startsAt,
      freePlan.interval
    );

    const [newSub] = await tx
      .insert(subscriptions)
      .values({
        userId,
        planId: freePlan.id,
        status: "active",
        startsAt,
        endsAt,
      })
      .returning();

    if (!newSub) {
      throw new Error("FREE_SUBSCRIPTION_CREATION_FAILED");
    }

    await createUsagePeriod(
      tx,
      newSub.id,
      userId,
      startsAt,
      endsAt
    );

    console.log("[subscription] granted Free plan", {
      userId,
      subscriptionId: newSub.id,
      planId: freePlan.id,
      endsAt: endsAt.toISOString(),
    });
  });
}

async function maybeExtendFreeSubscription(
  userId: string
): Promise<void> {
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
        eq(subscriptions.userId, userId),
        inArray(
          subscriptions.status,
          ACTIVE_SUBSCRIPTION_STATUSES
        ),
        eq(plans.price, 0)
      )
    )
    .orderBy(desc(subscriptions.endsAt))
    .limit(1);

  if (!row) return;

  const { subscription, plan } = row;

  if (subscription.endsAt > now) return;

  const periodStart = subscription.endsAt;
  const periodEnd = calculateEndDate(
    periodStart,
    plan.interval
  );

  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscription.id))
      .for("update");

    if (!locked) return;

    if (locked.endsAt > now) return;

    await tx
      .update(subscriptions)
      .set({
        status: "active",
        endsAt: periodEnd,
        cancelledAt: null,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, subscription.id));

    await createUsagePeriod(
      tx,
      subscription.id,
      userId,
      periodStart,
      periodEnd
    );
  });

  console.log("[subscription] extended Free plan", {
    userId,
    subscriptionId: subscription.id,
    newPeriodStart: periodStart.toISOString(),
    newPeriodEnd: periodEnd.toISOString(),
  });
}

/* =========================================================
   PUBLIC — DATES
========================================================= */

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

    /*
     * Fetch as an array first, then destructure into an
     * explicitly-typed `let`. This lets us reassign it to
     * `undefined` below (after expiring a Free plan) without
     * TypeScript complaining that `undefined` isn't
     * assignable to the subscription type.
     */
    const existingActiveSubscriptions = await tx
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

    let existingActiveSubscription: Subscription | undefined =
      existingActiveSubscriptions[0];

    /* ---------- 8a. Free plan upgrade — replace, don't stack ---------- */

    if (existingActiveSubscription) {
      const [existingPlan] = await tx
        .select()
        .from(plans)
        .where(eq(plans.id, existingActiveSubscription.planId))
        .limit(1);

      if (existingPlan && Number(existingPlan.price) === 0) {
        const expiredSubscriptionId = existingActiveSubscription.id;

        await tx
          .update(subscriptions)
          .set({
            status: "expired",
            updatedAt: now,
          })
          .where(eq(subscriptions.id, expiredSubscriptionId));

        console.log(
          "[subscription] expired Free plan to make room for paid upgrade",
          {
            userId,
            expiredSubscriptionId,
            newPlanId: plan.id,
          }
        );

        existingActiveSubscription = undefined;
      }
    }

    /* ---------- 8b. Same plan still active — extend ---------- */

    if (
      existingActiveSubscription &&
      existingActiveSubscription.planId === plan.id
    ) {
      const extensionStart = new Date(
        existingActiveSubscription.endsAt
      );

      const extensionEnd = calculateEndDate(
        extensionStart,
        plan.interval
      );

      await tx
        .update(subscriptions)
        .set({
          endsAt: extensionEnd,
          updatedAt: now,
        })
        .where(
          eq(subscriptions.id, existingActiveSubscription.id)
        );

      await createUsagePeriod(
        tx,
        existingActiveSubscription.id,
        userId,
        extensionStart,
        extensionEnd
      );

      const [linkedPayment] = await tx
        .update(payments)
        .set({
          subscriptionId: existingActiveSubscription.id,
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

      console.log("[subscription] extended same plan", {
        subscriptionId: existingActiveSubscription.id,
        userId,
        planId: plan.id,
        planName: plan.name,
        newEndsAt: extensionEnd.toISOString(),
      });

      return existingActiveSubscription;
    }

    /* ---------- 9. Different plan (or no subscription) — stack ---------- */

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

    /* ---------- 3. Resolve pending plan change (if any) ---------- */

    let effectiveInterval = planInterval;

    if (subscription.pendingPlanId) {
      const [newPlan] = await tx
        .select()
        .from(plans)
        .where(eq(plans.id, subscription.pendingPlanId))
        .limit(1);

      if (newPlan && newPlan.isActive) {
        await tx
          .update(subscriptions)
          .set({
            planId: newPlan.id,
            pendingPlanId: null,
            pendingChangeAt: null,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, subscriptionId));

        effectiveInterval = newPlan.interval;

        console.log(
          "[subscription] pending plan change applied",
          {
            subscriptionId,
            newPlanId: newPlan.id,
            newPlanName: newPlan.name,
            newInterval: newPlan.interval,
          }
        );
      } else {
        console.error(
          "[subscription] pending plan is missing or inactive; clearing",
          {
            subscriptionId,
            pendingPlanId: subscription.pendingPlanId,
          }
        );

        await tx
          .update(subscriptions)
          .set({
            pendingPlanId: null,
            pendingChangeAt: null,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, subscriptionId));
      }
    }

    /* ---------- 4. Compute new period boundaries ---------- */

    const now = new Date();

    const rawPeriodStart =
      subscription.endsAt > now ? subscription.endsAt : now;

    const periodStart = new Date(
      rawPeriodStart.getTime() + 1
    );

    const periodEnd = calculateEndDate(
      periodStart,
      effectiveInterval
    );

    /* ---------- 5. Extend the subscription ---------- */

    await tx
      .update(subscriptions)
      .set({
        status: "active",
        endsAt: periodEnd,
        cancelledAt: null,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, subscriptionId));

    /* ---------- 6. Create the new usage period ---------- */

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
        target: [subscriptionUsage.renewalReference],
      });

    /* ---------- 7. Audit trail ---------- */

    console.log("[subscription] renewed", {
      subscriptionId,
      userId: subscription.userId,
      renewalReference,
      effectiveInterval,
      newPeriodStart: periodStart.toISOString(),
      newPeriodEnd: periodEnd.toISOString(),
    });
  });
}

/* =========================================================
   PUBLIC — CANCELLATION
========================================================= */

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