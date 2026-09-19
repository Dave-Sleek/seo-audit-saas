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

export async function getPlanById(
  planId: string
) {
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

/*
 * ---------------------------------------------------------
 * Expire all subscriptions whose end date has passed.
 * ---------------------------------------------------------
 *
 * This can later be called by a cron job.
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

/*
 * ---------------------------------------------------------
 * Get active subscription for a user
 * ---------------------------------------------------------
 */

export async function getActiveSubscription(
  userId: string
) {
  const now = new Date();

  /*
   * First expire any subscriptions that have already ended.
   */

  await expireUserSubscriptions(userId);

  const [subscription] = await db
    .select({
      subscription: subscriptions,
      plan: plans,
    })
    .from(subscriptions)
    .innerJoin(
      plans,
      eq(subscriptions.planId, plans.id)
    )
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
    .orderBy(
      desc(subscriptions.endsAt)
    )
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

export async function getUserSubscription(
  userId: string
) {
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
      endDate.setDate(
        endDate.getDate() + 1
      );
      break;

    case "weekly":
      endDate.setDate(
        endDate.getDate() + 7
      );
      break;

    case "monthly":
      endDate.setMonth(
        endDate.getMonth() + 1
      );
      break;

    case "quarterly":
      endDate.setMonth(
        endDate.getMonth() + 3
      );
      break;

    case "biannual":
    case "semiannual":
      endDate.setMonth(
        endDate.getMonth() + 6
      );
      break;

    case "annual":
    case "yearly":
      endDate.setFullYear(
        endDate.getFullYear() + 1
      );
      break;

    default:
      /*
       * Default paid subscription interval.
       */
      endDate.setMonth(
        endDate.getMonth() + 1
      );
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
  tx: any,
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
 * Activate subscription
 * ---------------------------------------------------------
 *
 * THIS IS THE IMPORTANT IDEMPOTENCY LAYER.
 *
 * Callback and webhook can arrive at exactly the same time.
 *
 * We lock the payment row inside the transaction:
 *
 * SELECT ... FOR UPDATE
 *
 * This means:
 *
 * Request A
 *    ↓
 * locks payment
 *    ↓
 * creates subscription
 *    ↓
 * links payment
 *    ↓
 * commits
 *
 * Request B
 *    ↓
 * waits for payment lock
 *    ↓
 * sees subscriptionId
 *    ↓
 * returns existing subscription
 *
 * Therefore only ONE subscription can be created.
 * ---------------------------------------------------------
 */

export async function activateSubscription({
  paymentId,
  userId,
}: {
  paymentId: string;
  userId: string;
}) {
  return await db.transaction(
    async (tx) => {
      /*
       * -------------------------------------------------------
       * 1. Lock payment row
       * -------------------------------------------------------
       *
       * FOR UPDATE prevents callback + webhook from processing
       * the same payment concurrently.
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

      const payment =
        lockedPayments[0];

      if (!payment) {
        throw new Error(
          "PAYMENT_NOT_FOUND"
        );
      }

      /*
       * -------------------------------------------------------
       * 2. Already activated?
       * -------------------------------------------------------
       *
       * This is the primary idempotency check.
       */

      if (payment.subscriptionId) {
        const [existingSubscription] =
          await tx
            .select()
            .from(subscriptions)
            .where(
              eq(
                subscriptions.id,
                payment.subscriptionId
              )
            )
            .limit(1);

        if (existingSubscription) {
          return existingSubscription;
        }

        /*
         * Extremely unusual case:
         *
         * payment.subscriptionId exists but the subscription
         * row doesn't.
         *
         * Because both are supposed to be created in the same
         * transaction, this should not normally happen.
         *
         * We stop rather than creating a duplicate.
         */

        throw new Error(
          "PAYMENT_SUBSCRIPTION_REFERENCE_INVALID"
        );
      }

      /*
       * -------------------------------------------------------
       * 3. Payment must be successful
       * -------------------------------------------------------
       */

      if (payment.status !== "success") {
        throw new Error(
          "PAYMENT_NOT_SUCCESSFUL"
        );
      }

      /*
       * -------------------------------------------------------
       * 4. Load plan
       * -------------------------------------------------------
       */

      const [plan] = await tx
        .select()
        .from(plans)
        .where(
          eq(plans.id, payment.planId)
        )
        .limit(1);

      if (!plan) {
        throw new Error(
          "PLAN_NOT_FOUND"
        );
      }

      if (!plan.isActive) {
        throw new Error(
          "PLAN_NOT_ACTIVE"
        );
      }

      /*
       * -------------------------------------------------------
       * 5. Validate payment amount against plan
       * -------------------------------------------------------
       *
       * The payment amount must match the plan price stored in
       * our database.
       */

      if (
        Number(payment.amount) !==
        Number(plan.price)
      ) {
        throw new Error(
          "PAYMENT_PLAN_AMOUNT_MISMATCH"
        );
      }

      /*
       * -------------------------------------------------------
       * 6. Find current active subscription
       * -------------------------------------------------------
       *
       * Expire old subscriptions first.
       */

      const now = new Date();

      await tx
        .update(subscriptions)
        .set({
          status: "expired",
          updatedAt: now,
        })
        .where(
          and(
            eq(
              subscriptions.userId,
              userId
            ),
            inArray(
              subscriptions.status,
              ACTIVE_SUBSCRIPTION_STATUSES
            ),
            lte(
              subscriptions.endsAt,
              now
            )
          )
        );

      const [existingActiveSubscription] =
        await tx
          .select()
          .from(subscriptions)
          .where(
            and(
              eq(
                subscriptions.userId,
                userId
              ),
              inArray(
                subscriptions.status,
                ACTIVE_SUBSCRIPTION_STATUSES
              ),
              gt(
                subscriptions.endsAt,
                now
              )
            )
          )
          .orderBy(
            desc(subscriptions.endsAt)
          )
          .limit(1);

      /*
       * -------------------------------------------------------
       * 7. Determine subscription start date
       * -------------------------------------------------------
       *
       * If the user already has an active subscription, the
       * new subscription starts after the existing subscription
       * ends.
       *
       * Otherwise it starts immediately.
       */

      const startsAt =
        existingActiveSubscription
          ? new Date(
              existingActiveSubscription.endsAt
            )
          : now;

      const endsAt =
        calculateEndDate(
          startsAt,
          plan.interval
        );

      /*
       * -------------------------------------------------------
       * 8. Create subscription
       * -------------------------------------------------------
       */

      const [newSubscription] =
        await tx
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
        throw new Error(
          "SUBSCRIPTION_CREATION_FAILED"
        );
      }

      /*
       * -------------------------------------------------------
       * 9. Create usage period
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
       * 10. Link payment to subscription
       * -------------------------------------------------------
       */

      const [linkedPayment] =
        await tx
          .update(payments)
          .set({
            subscriptionId:
              newSubscription.id,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(
                payments.id,
                payment.id
              ),
              eq(
                payments.userId,
                userId
              ),
              sql`${payments.subscriptionId} IS NULL`
            )
          )
          .returning();

      /*
       * -------------------------------------------------------
       * 11. Verify that this transaction successfully claimed
       *     the payment.
       * -------------------------------------------------------
       */

      if (!linkedPayment) {
        /*
         * This should never happen because the payment row is
         * locked, but we fail safely if it does.
         */

        throw new Error(
          "PAYMENT_ALREADY_LINKED"
        );
      }

      /*
       * -------------------------------------------------------
       * 12. Return created subscription
       * -------------------------------------------------------
       */

      return newSubscription;
    }
  );
}

/*
 * ---------------------------------------------------------
 * Cancel subscription locally
 * ---------------------------------------------------------
 *
 * This does not yet cancel the Paystack recurring profile.
 * Paystack cancellation will be implemented in the recurring
 * subscription management stage.
 * ---------------------------------------------------------
 */

export async function cancelSubscription(
  userId: string
) {
  const [subscription] =
    await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(
            subscriptions.userId,
            userId
          ),
          eq(
            subscriptions.status,
            "active"
          )
        )
      )
      .orderBy(
        desc(subscriptions.endsAt)
      )
      .limit(1);

  if (!subscription) {
    return null;
  }

  const [updatedSubscription] =
    await db
      .update(subscriptions)
      .set({
        status: "non_renewing",
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        eq(
          subscriptions.id,
          subscription.id
        )
      )
      .returning();

  return updatedSubscription ?? null;
}

/*
 * ---------------------------------------------------------
 * Get current plan
 * ---------------------------------------------------------
 */

export async function getCurrentPlan(
  userId: string
) {
  const activeSubscription =
    await getActiveSubscription(
      userId
    );

  return (
    activeSubscription?.plan ??
    null
  );
}

/*
 * ---------------------------------------------------------
 * Check whether user has active subscription
 * ---------------------------------------------------------
 */

export async function hasActiveSubscription(
  userId: string
): Promise<boolean> {
  const activeSubscription =
    await getActiveSubscription(
      userId
    );

  return Boolean(
    activeSubscription
  );
}