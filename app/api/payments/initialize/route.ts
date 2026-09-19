import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/app/db";
import { payments, plans } from "@/app/db/schema";
import { getCurrentUser } from "@/app/lib/auth";
import {
  generatePaymentReference,
  getPaymentCallbackUrl,
  initializeTransaction,
} from "@/app/lib/paystack";

export async function POST(request: NextRequest) {
  try {
    /* ---------------------------------------------------------
     * 1. Authenticate user
     * --------------------------------------------------------- */

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    /* ---------------------------------------------------------
     * 2. Read request body
     * --------------------------------------------------------- */

    let body: { planId?: string };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request body." },
        { status: 400 }
      );
    }

    const planId = body.planId?.trim();

    if (!planId) {
      return NextResponse.json(
        { success: false, error: "Plan ID is required." },
        { status: 400 }
      );
    }

    /* ---------------------------------------------------------
     * 3. Load plan from database
     *
     * Never trust the price, currency, interval, or Paystack
     * plan code supplied by the browser.
     * --------------------------------------------------------- */

    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1);

    if (!plan) {
      return NextResponse.json(
        { success: false, error: "Plan not found." },
        { status: 404 }
      );
    }

    /* ---------------------------------------------------------
     * 4. Plan must be active
     * --------------------------------------------------------- */

    if (!plan.isActive) {
      return NextResponse.json(
        { success: false, error: "This plan is no longer available." },
        { status: 400 }
      );
    }

    /* ---------------------------------------------------------
     * 5. Free plans don't go through Paystack
     * --------------------------------------------------------- */

    if (plan.price <= 0) {
      return NextResponse.json(
        { success: false, error: "This plan does not require payment." },
        { status: 400 }
      );
    }

    /* ---------------------------------------------------------
     * 6. Paid recurring plans must have a Paystack plan code
     * --------------------------------------------------------- */

    if (!plan.paystackPlanCode) {
      return NextResponse.json(
        {
          success: false,
          error: "This plan is not configured for Paystack subscriptions.",
        },
        { status: 400 }
      );
    }

    /* ---------------------------------------------------------
     * 7. Generate unique payment reference
     * --------------------------------------------------------- */

    const reference = generatePaymentReference();

    /* ---------------------------------------------------------
     * 8. Amount
     *
     * plans.price is stored in the smallest currency unit
     * (kobo for NGN) — the same unit Paystack expects.
     *
     * No conversion needed.
     *
     * ₦5,000 → 500000 kobo → sent as-is
     * --------------------------------------------------------- */

    /* ---------------------------------------------------------
     * 9. Create pending payment locally
     *
     * Schema notes:
     *   ▸ provider is required (no DB default) — pass explicitly
     *   ▸ amount is numeric(12, 2) — pass as string
     *   ▸ no plan_id column — store plan in metadata
     *   ▸ no payment_type column — omit
     * --------------------------------------------------------- */

    const [payment] = await db
      .insert(payments)
      .values({
        userId: user.id,
        provider: "paystack",
        reference,
        amount: plan.price.toString(),
        currency: plan.currency,
        status: "pending",
        metadata: {
          planId: plan.id,
          planSlug: plan.slug,
          userId: user.id,
          type: "subscription",
        },
      })
      .returning();

    if (!payment) {
      throw new Error("Unable to create payment record.");
    }

    /* ---------------------------------------------------------
     * 10. Initialize transaction with Paystack
     * --------------------------------------------------------- */

    let paystackResponse;

    try {
      paystackResponse = await initializeTransaction({
        email: user.email,

        /*
         * plan.price is already in kobo — matches Paystack's
         * expected unit and the plan's configured amount.
         */
        amount: plan.price,

        currency: plan.currency,

        reference,

        callbackUrl: getPaymentCallbackUrl(),

        /*
         * Passing planCode makes this a recurring subscription.
         */
        planCode: plan.paystackPlanCode,

        metadata: {
          userId: user.id,
          planId: plan.id,
          paymentId: payment.id,
          reference,
          type: "subscription",
        },
      });
    } catch (error) {
      /*
       * Paystack initialization failed. Mark local payment as
       * failed for auditing.
       */

      await db
        .update(payments)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(payments.id, payment.id));

      console.error(
        "Paystack transaction initialization failed:",
        error instanceof Error ? error.message : error
      );

      const isDev = process.env.NODE_ENV === "development";

      return NextResponse.json(
        {
          success: false,
          error: isDev && error instanceof Error
            ? error.message
            : "Unable to initialize payment. Please try again.",
        },
        { status: 502 }
      );
    }

    /* ---------------------------------------------------------
     * 11. Save provider transaction ID
     *
     * Column name in DB is provider_transaction_id
     * --------------------------------------------------------- */

    if (paystackResponse.data?.id) {
      await db
        .update(payments)
        .set({
          providerTransactionId: String(paystackResponse.data.id),
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));
    }

    /* ---------------------------------------------------------
     * 12. Return checkout information
     * --------------------------------------------------------- */

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      reference,
      authorizationUrl: paystackResponse.data.authorization_url,
      accessCode: paystackResponse.data.access_code,
    });
  } catch (error) {
    console.error("Payment initialization error:", error);

    const isDev = process.env.NODE_ENV === "development";

    return NextResponse.json(
      {
        success: false,
        error: isDev
          ? error instanceof Error
            ? error.message
            : "Unknown error"
          : "Something went wrong while initializing payment.",
        ...(isDev &&
          error instanceof Error && {
            debug: {
              name: error.name,
              stack: error.stack?.split("\n").slice(0, 5).join("\n"),
            },
          }),
      },
      { status: 500 }
    );
  }
}