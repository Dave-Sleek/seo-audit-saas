import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/app/db";
import { payments, plans, subscriptions } from "@/app/db/schema";
import { createNotification } from "@/app/lib/notifications";
import {
  validatePaystackPayment,
  verifyPaystackWebhookSignature,
  verifyTransaction,
} from "@/app/lib/paystack";
import {
  activateSubscription,
  extendSubscriptionFromRenewal,
} from "@/app/lib/subscription";

/* =========================================================
   PAYSTACK EVENT SHAPES
   ========================================================= */

type PaystackChargeSuccessData = {
  id?: number | string;
  reference?: string;
  status?: string;
  amount?: number;
  currency?: string;
  paid_at?: string;
  customer?: {
    email?: string;
    customer_code?: string;
  };
  plan?: {
    plan_code?: string;
  } | null;
  subscription?: {
    subscription_code?: string;
    email_token?: string;
  } | null;
};

type PaystackSubscriptionData = {
  subscription_code?: string;
  email_token?: string;
  status?: string;
  customer?: {
    email?: string;
    customer_code?: string;
  };
  plan?: {
    plan_code?: string;
  } | null;
  next_payment_date?: string;
};

type PaystackInvoiceData = {
  subscription?: {
    subscription_code?: string;
  } | null;
  customer?: {
    customer_code?: string;
  } | null;
  amount?: number;
  paid?: boolean;
  paid_at?: string;
};

/* =========================================================
   WEBHOOK
   ========================================================= */

export async function POST(request: NextRequest) {
  try {
    /* ---------------------------------------------------------
     * 1. Read raw body
     * --------------------------------------------------------- */

    const rawBody = await request.text();

    if (!rawBody) {
      return NextResponse.json(
        { success: false, error: "Empty webhook body." },
        { status: 400 }
      );
    }

    /* ---------------------------------------------------------
     * 2. Verify signature
     * --------------------------------------------------------- */

    const signature = request.headers.get("x-paystack-signature");

    if (!signature) {
      console.error("Paystack webhook rejected: missing signature.");
      return NextResponse.json(
        { success: false, error: "Missing webhook signature." },
        { status: 401 }
      );
    }

    if (!verifyPaystackWebhookSignature(rawBody, signature)) {
      console.error("Paystack webhook rejected: invalid signature.");
      return NextResponse.json(
        { success: false, error: "Invalid webhook signature." },
        { status: 401 }
      );
    }

    /* ---------------------------------------------------------
     * 3. Parse payload
     * --------------------------------------------------------- */

    let payload: { event?: string; data?: unknown };

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid webhook payload." },
        { status: 400 }
      );
    }

    const event = payload.event;
    const data = payload.data as Record<string, unknown> | undefined;

    if (!event) {
      return NextResponse.json(
        { success: false, error: "Missing event type." },
        { status: 400 }
      );
    }

    /* ---------------------------------------------------------
     * 4. Dispatch by event type
     * --------------------------------------------------------- */

    try {
      switch (event) {
        case "charge.success":
          await handleChargeSuccess(data as PaystackChargeSuccessData);
          break;

        case "subscription.create":
          await handleSubscriptionCreate(
            data as PaystackSubscriptionData
          );
          break;

        case "subscription.not_renew":
          await handleSubscriptionNotRenew(
            data as PaystackSubscriptionData
          );
          break;

        case "subscription.disable":
          await handleSubscriptionDisable(
            data as PaystackSubscriptionData
          );
          break;

        case "invoice.payment_failed":
          await handleInvoicePaymentFailed(data as PaystackInvoiceData);
          break;

        default:
          /* Unknown events are acknowledged but ignored. */
          break;
      }
    } catch (handlerError) {
      console.error(
        `Paystack webhook handler failed for "${event}":`,
        handlerError instanceof Error
          ? handlerError.message
          : handlerError
      );

      return NextResponse.json(
        { success: false, error: "Handler failed." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Event received.",
    });
  } catch (error) {
    console.error(
      "Paystack webhook error:",
      error instanceof Error ? error.message : error,
      error instanceof Error ? error.stack : undefined
    );

    return NextResponse.json(
      { success: false, error: "Webhook processing failed." },
      { status: 500 }
    );
  }
}

/* =========================================================
   HANDLER — charge.success
   ========================================================= */

async function handleChargeSuccess(data: PaystackChargeSuccessData) {
  const reference = data.reference?.trim();

  if (!reference) {
    throw new Error("charge.success: missing reference");
  }

  /* ---------- Look for a local payment ---------- */

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.reference, reference))
    .limit(1);

  /* =========================================================
     CASE A: initial payment (payment row exists)
  ========================================================= */

  if (payment) {
    /* Idempotency: already processed */
    if (payment.status === "successful" && payment.subscriptionId) {
      return;
    }

    /* Verify with Paystack */
    const verification = await verifyTransaction(reference);
    const transaction = verification.data;

    /* Validate amount / currency / status */
    validatePaystackPayment({
      paystackAmount: transaction.amount,
      expectedAmount: payment.amount,
      paystackCurrency: transaction.currency,
      expectedCurrency: payment.currency,
      paystackStatus: transaction.status,
    });

    /* Reference sanity check */
    if (transaction.reference !== payment.reference) {
      throw new Error(
        `charge.success: reference mismatch (expected ${payment.reference}, got ${transaction.reference})`
      );
    }

    /* Mark payment successful */
    const [updatedPayment] = await db
      .update(payments)
      .set({
        status: "successful",
        paidAt: transaction.paid_at
          ? new Date(transaction.paid_at)
          : new Date(),
        providerTransactionId:
          transaction.id !== undefined
            ? String(transaction.id)
            : payment.providerTransactionId,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id))
      .returning();

    if (!updatedPayment) {
      throw new Error("charge.success: failed to update payment");
    }

    /* Activate the subscription */
    const activatedSubscription = await activateSubscription({
      paymentId: updatedPayment.id,
      userId: updatedPayment.userId,
    });

    /* Load the plan for the notification body */
    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, activatedSubscription.planId))
      .limit(1);

    /* ---------- Notify: payment succeeded ---------- */

    await createNotification({
      userId: updatedPayment.userId,
      type: "payment.succeeded",
      title: "Payment received",
      body: plan
        ? `Your ${plan.name} subscription is now active.`
        : "Your subscription is now active.",
      actionUrl: "/dashboard/subscription",
      metadata: {
        paymentId: updatedPayment.id,
        subscriptionId: activatedSubscription.id,
        amount: Number(updatedPayment.amount),
        planName: plan?.name ?? null,
      },
    });

    return;
  }

  /* =========================================================
     CASE B: renewal (no local payment row)
  ========================================================= */

  const customerCode = data.customer?.customer_code;
  const subscriptionCode = data.subscription?.subscription_code;

  if (!customerCode && !subscriptionCode) {
    console.error(
      "charge.success renewal: no customer_code or subscription_code in payload",
      { reference, email: data.customer?.email }
    );
    return;
  }

  /* Find the subscription by subscription code first, then by customer code */

  let existingSubscription;

  if (subscriptionCode) {
    [existingSubscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.paystackSubscriptionCode, subscriptionCode))
      .limit(1);
  }

  if (!existingSubscription && customerCode) {
    [existingSubscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.paystackCustomerCode, customerCode))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
  }

  if (!existingSubscription) {
    console.error(
      "charge.success renewal: no matching subscription found",
      { reference, customerCode, subscriptionCode }
    );
    return;
  }

  /* Verify with Paystack */
  const verification = await verifyTransaction(reference);
  const transaction = verification.data;

  if (transaction.status !== "success") {
    console.error(
      "charge.success renewal: transaction not successful",
      { reference, status: transaction.status }
    );
    return;
  }

  /* Load the plan for the subscription */
  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, existingSubscription.planId))
    .limit(1);

  if (!plan) {
    throw new Error("charge.success renewal: plan not found");
  }

  /* Validate the amount matches the plan price */
  const paidAmount = Math.round(Number(transaction.amount));
  const planPrice = Math.round(Number(plan.price));

  if (paidAmount !== planPrice) {
    console.error(
      "charge.success renewal: amount mismatch",
      { paidAmount, planPrice, reference }
    );
    return;
  }

  /* ---------- Create a payments row for the renewal ---------- */

  const [renewalPayment] = await db
    .insert(payments)
    .values({
      userId: existingSubscription.userId,
      subscriptionId: existingSubscription.id,
      provider: "paystack",
      reference: transaction.reference,
      amount: String(transaction.amount),
      currency: transaction.currency,
      status: "successful",
      paidAt: transaction.paid_at
        ? new Date(transaction.paid_at)
        : new Date(),
      providerTransactionId:
        transaction.id !== undefined ? String(transaction.id) : null,
      metadata: {
        planId: plan.id,
        planSlug: plan.slug,
        type: "renewal",
      },
    })
    .returning();

  /* ---------- Extend the subscription ---------- */

  await extendSubscriptionFromRenewal({
    subscriptionId: existingSubscription.id,
    planInterval: plan.interval,
    renewalReference: reference,
  });

  /* ---------- Notify: subscription renewed ---------- */

  await createNotification({
    userId: existingSubscription.userId,
    type: "subscription.renewed",
    title: "Subscription renewed",
    body: `Your ${plan.name} subscription has been renewed.`,
    actionUrl: "/dashboard/subscription",
    metadata: {
      paymentId: renewalPayment?.id ?? null,
      subscriptionId: existingSubscription.id,
      amount: Number(transaction.amount),
      planName: plan.name,
    },
  });
}

/* =========================================================
   HANDLER — subscription.create
   ========================================================= */

async function handleSubscriptionCreate(data: PaystackSubscriptionData) {
  const subscriptionCode = data.subscription_code;
  const emailToken = data.email_token;
  const customerCode = data.customer?.customer_code;

  if (!subscriptionCode) {
    throw new Error("subscription.create: missing subscription_code");
  }

  if (!customerCode) {
    console.error("subscription.create: missing customer_code");
    return;
  }

  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.paystackCustomerCode, customerCode))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!existing) {
    /*
     * This can happen if subscription.create arrives before
     * the initial charge.success has been processed.
     *
     * Paystack retries webhooks, so we'll get it again.
     * Throw so the retry happens.
     */

    throw new Error(
      "subscription.create: no matching subscription yet — will retry"
    );
  }

  await db
    .update(subscriptions)
    .set({
      paystackSubscriptionCode: subscriptionCode,
      paystackEmailToken: emailToken ?? existing.paystackEmailToken,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, existing.id));
}

/* =========================================================
   HANDLER — subscription.not_renew
   ========================================================= */

async function handleSubscriptionNotRenew(
  data: PaystackSubscriptionData
) {
  const subscriptionCode = data.subscription_code;

  if (!subscriptionCode) {
    throw new Error("subscription.not_renew: missing subscription_code");
  }

  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.paystackSubscriptionCode, subscriptionCode))
    .limit(1);

  if (!existing) {
    console.error(
      "subscription.not_renew: no matching subscription",
      { subscriptionCode }
    );
    return;
  }

  /* Idempotency: already marked */
  if (existing.status === "non_renewing") {
    return;
  }

  await db
    .update(subscriptions)
    .set({
      status: "non_renewing",
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, existing.id));

  /* ---------- Notify: auto-renew disabled ---------- */

  await createNotification({
    userId: existing.userId,
    type: "subscription.renewal_disabled",
    title: "Auto-renewal disabled",
    body: `Your subscription will end on ${existing.endsAt.toLocaleDateString()}. You can re-enable auto-renewal anytime.`,
    actionUrl: "/dashboard/subscription",
    metadata: {
      subscriptionId: existing.id,
      endsAt: existing.endsAt.toISOString(),
    },
  });
}

/* =========================================================
   HANDLER — subscription.disable
   ========================================================= */

async function handleSubscriptionDisable(data: PaystackSubscriptionData) {
  const subscriptionCode = data.subscription_code;

  if (!subscriptionCode) {
    throw new Error("subscription.disable: missing subscription_code");
  }

  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.paystackSubscriptionCode, subscriptionCode))
    .limit(1);

  if (!existing) {
    console.error(
      "subscription.disable: no matching subscription",
      { subscriptionCode }
    );
    return;
  }

  /* Idempotency: already disabled */
  if (existing.status === "cancelled") {
    return;
  }

  await db
    .update(subscriptions)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, existing.id));

  /* ---------- Notify: subscription cancelled ---------- */

  await createNotification({
    userId: existing.userId,
    type: "subscription.cancelled",
    title: "Subscription cancelled",
    body: "Your subscription has been cancelled. You can resubscribe anytime from the pricing page.",
    actionUrl: "/pricing",
    metadata: {
      subscriptionId: existing.id,
    },
  });
}

/* =========================================================
   HANDLER — invoice.payment_failed
   ========================================================= */

async function handleInvoicePaymentFailed(data: PaystackInvoiceData) {
  const subscriptionCode = data.subscription?.subscription_code;

  if (!subscriptionCode) {
    throw new Error("invoice.payment_failed: missing subscription_code");
  }

  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.paystackSubscriptionCode, subscriptionCode))
    .limit(1);

  if (!existing) {
    console.error(
      "invoice.payment_failed: no matching subscription",
      { subscriptionCode }
    );
    return;
  }

  await db
    .update(subscriptions)
    .set({
      status: "past_due",
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, existing.id));

  /* ---------- Notify: payment failed ---------- */

  await createNotification({
    userId: existing.userId,
    type: "payment.failed",
    title: "Payment failed",
    body: "We couldn't charge your card. Update your payment details to keep your subscription active.",
    actionUrl: "/dashboard/subscription",
    metadata: {
      subscriptionId: existing.id,
      amount: data.amount ?? null,
    },
  });
}