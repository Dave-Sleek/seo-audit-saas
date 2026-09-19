import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/app/db";
import { payments } from "@/app/db/schema";
import {
  getAppUrl,
  validatePaystackPayment,
  verifyTransaction,
} from "@/app/lib/paystack";
import { activateSubscription } from "@/app/lib/subscription";

export async function GET(request: NextRequest) {
  const appUrl = getAppUrl();

  try {
    /* ---------------------------------------------------------
     * 1. Get Paystack reference
     *
     * Paystack sends both `reference` and `trxref`. They should
     * be identical, but read `reference` first with `trxref`
     * as a fallback.
     * --------------------------------------------------------- */

    const reference =
      request.nextUrl.searchParams.get("reference")?.trim() ||
      request.nextUrl.searchParams.get("trxref")?.trim();

    if (!reference) {
      return NextResponse.redirect(
        new URL("/pricing?payment=missing_reference", appUrl)
      );
    }

    /* ---------------------------------------------------------
     * 2. Find local payment
     * --------------------------------------------------------- */

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.reference, reference))
      .limit(1);

    if (!payment) {
      console.error(
        "Paystack callback: payment not found:",
        reference
      );

      return NextResponse.redirect(
        new URL("/pricing?payment=not_found", appUrl)
      );
    }

    /* ---------------------------------------------------------
     * 3. Already processed? (idempotency guard)
     * --------------------------------------------------------- */

    if (
      payment.status === "successful" &&
      payment.subscriptionId
    ) {
      return NextResponse.redirect(
        new URL("/dashboard/subscription?payment=success", appUrl)
      );
    }

    /* ---------------------------------------------------------
     * 4. Verify transaction with Paystack
     * --------------------------------------------------------- */

    let verification;

    try {
      verification = await verifyTransaction(reference);
    } catch (error) {
      console.error(
        "Paystack callback verification failed:",
        error instanceof Error ? error.message : error
      );

      return NextResponse.redirect(
        new URL("/pricing?payment=verification_failed", appUrl)
      );
    }

    const transaction = verification.data;

    /* ---------------------------------------------------------
     * 5. Validate transaction
     *
     * validatePaystackPayment handles number-vs-string
     * normalization internally so we don't need to divide or
     * multiply here.
     * --------------------------------------------------------- */

    try {
      validatePaystackPayment({
        paystackAmount: transaction.amount,
        expectedAmount: payment.amount,
        paystackCurrency: transaction.currency,
        expectedCurrency: payment.currency,
        paystackStatus: transaction.status,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown validation error";

      console.error(
        "Paystack callback validation failed:",
        message,
        {
          paystackAmount: transaction.amount,
          paystackCurrency: transaction.currency,
          paystackStatus: transaction.status,
          expectedAmount: payment.amount,
          expectedCurrency: payment.currency,
          reference,
        }
      );

      await db
        .update(payments)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(payments.id, payment.id));

      return NextResponse.redirect(
        new URL("/pricing?payment=validation_failed", appUrl)
      );
    }

    /* ---------------------------------------------------------
     * 6. Explicit reference validation
     * --------------------------------------------------------- */

    if (transaction.reference !== payment.reference) {
      console.error(
        "Paystack callback reference mismatch:",
        {
          expected: payment.reference,
          received: transaction.reference,
        }
      );

      await db
        .update(payments)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(payments.id, payment.id));

      return NextResponse.redirect(
        new URL("/pricing?payment=reference_mismatch", appUrl)
      );
    }

    /* ---------------------------------------------------------
     * 7. Mark payment successful
     *
     * IMPORTANT:
     *   ▸ DB check constraint allows: pending | successful | failed | refunded
     *   ▸ Column is provider_transaction_id, NOT paystack_transaction_id
     * --------------------------------------------------------- */

    const [updatedPayment] = await db
      .update(payments)
      .set({
        status: "successful",                     // ← matches DB constraint
        paidAt: transaction.paid_at
          ? new Date(transaction.paid_at)
          : new Date(),
        providerTransactionId:
          transaction.id !== undefined
            ? String(transaction.id)
            : payment.providerTransactionId,      // ← renamed field
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id))
      .returning();

    if (!updatedPayment) {
      return NextResponse.redirect(
        new URL("/pricing?payment=processing_error", appUrl)
      );
    }

    /* ---------------------------------------------------------
     * 8. Activate subscription
     *
     * The subscription service handles concurrency and
     * idempotency using SELECT ... FOR UPDATE.
     * --------------------------------------------------------- */

    try {
      await activateSubscription({
        paymentId: updatedPayment.id,
        userId: updatedPayment.userId,
      });
    } catch (error) {
      console.error(
        "Paystack callback subscription activation failed:",
        error instanceof Error ? error.message : error
      );

      /*
       * Payment remains SUCCESSFUL.
       * Webhook/retry can safely complete activation.
       */

      return NextResponse.redirect(
        new URL("/pricing?payment=activation_pending", appUrl)
      );
    }

    /* ---------------------------------------------------------
     * 9. Success
     * --------------------------------------------------------- */

    return NextResponse.redirect(
      new URL("/dashboard/subscription?payment=success", appUrl)
    );
  } catch (error) {
    console.error(
      "Paystack callback error:",
      error instanceof Error ? error.message : error,
      error instanceof Error ? error.stack : undefined
    );

    return NextResponse.redirect(
      new URL("/pricing?payment=error", appUrl)
    );
  }
}