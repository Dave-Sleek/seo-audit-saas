import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/app/db";
import {
  payments,
  plans,
} from "@/app/db/schema";
import { getCurrentUser } from "@/app/lib/auth";
import {
  generatePaymentReference,
  initializeTransaction,
} from "@/app/lib/paystack";

export async function POST(request: NextRequest) {
  try {
    /*
     * ---------------------------------------------------------
     * 1. Authenticate user
     * ---------------------------------------------------------
     */

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 2. Read request body
     * ---------------------------------------------------------
     */

    let body: {
      planId?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const planId = body.planId?.trim();

    if (!planId) {
      return NextResponse.json(
        {
          success: false,
          error: "Plan ID is required.",
        },
        { status: 400 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 3. Load plan from database
     *
     * Never trust the price, currency, interval, or Paystack
     * plan code supplied by the browser.
     * ---------------------------------------------------------
     */

    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1);

    if (!plan) {
      return NextResponse.json(
        {
          success: false,
          error: "Plan not found.",
        },
        { status: 404 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 4. Make sure plan is active
     * ---------------------------------------------------------
     */

    if (!plan.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: "This plan is no longer available.",
        },
        { status: 400 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 5. Free plans do not go through Paystack
     * ---------------------------------------------------------
     */

    if (plan.price <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "This plan does not require payment.",
        },
        { status: 400 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 6. Paid recurring plans must have a Paystack plan code
     *
     * This prevents accidentally creating a one-time payment
     * for a subscription plan.
     * ---------------------------------------------------------
     */

    if (!plan.paystackPlanCode) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This plan is not configured for Paystack subscriptions.",
        },
        { status: 400 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 7. Generate unique payment reference
     * ---------------------------------------------------------
     */

    const reference = generatePaymentReference();

    /*
     * ---------------------------------------------------------
     * 8. Convert plan price to Paystack's smallest currency unit
     *
     * Example:
     *
     * ₦5,000 -> 500000
     *
     * Your plans table stores the normal currency amount.
     * Paystack expects the smallest currency unit.
     * ---------------------------------------------------------
     */

    const amountInSubunit = Math.round(plan.price * 100);

    /*
     * ---------------------------------------------------------
     * 9. Create pending payment locally first
     * ---------------------------------------------------------
     */

    const [payment] = await db
      .insert(payments)
      .values({
        userId: user.id,
        planId: plan.id,
        reference,
        amount: plan.price,
        currency: plan.currency,
        status: "pending",
      })
      .returning();

    /*
     * ---------------------------------------------------------
     * 10. Initialize transaction with Paystack
     * ---------------------------------------------------------
     */

    let paystackResponse;

    try {
      paystackResponse = await initializeTransaction({
        email: user.email,
        amount: amountInSubunit,
        currency: plan.currency,
        reference,
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
       * -------------------------------------------------------
       * Paystack initialization failed.
       *
       * Keep the payment record for auditing, but mark it
       * failed so it cannot later be mistaken for a pending
       * payment.
       * -------------------------------------------------------
       */

      await db
        .update(payments)
        .set({
          status: "failed",
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));

      console.error(
        "Paystack transaction initialization failed:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to initialize payment. Please try again.",
        },
        { status: 502 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 11. Save Paystack transaction ID if returned
     * ---------------------------------------------------------
     */

    if (paystackResponse.data?.id) {
      await db
        .update(payments)
        .set({
          paystackTransactionId: String(
            paystackResponse.data.id
          ),
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));
    }

    /*
     * ---------------------------------------------------------
     * 12. Return checkout information
     * ---------------------------------------------------------
     */

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      reference,
      authorizationUrl:
        paystackResponse.data.authorization_url,
      accessCode:
        paystackResponse.data.access_code,
    });
  } catch (error) {
    console.error(
      "Payment initialization error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Something went wrong while initializing payment.",
      },
      { status: 500 }
    );
  }
}