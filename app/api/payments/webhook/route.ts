import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/app/db";
import { payments } from "@/app/db/schema";
import {
  validatePaystackPayment,
  verifyPaystackWebhookSignature,
  verifyTransaction,
} from "@/app/lib/paystack";
import { activateSubscription } from "@/app/lib/subscription";

export async function POST(request: NextRequest) {
  try {
    /* ---------------------------------------------------------
     * 1. Read raw body (required for HMAC verification)
     * --------------------------------------------------------- */

    const rawBody = await request.text();

    if (!rawBody) {
      return NextResponse.json(
        { success: false, error: "Empty webhook body." },
        { status: 400 }
      );
    }

    /* ---------------------------------------------------------
     * 2. Verify Paystack signature
     * --------------------------------------------------------- */

    const signature = request.headers.get("x-paystack-signature");

    if (!signature) {
      console.error("Paystack webhook rejected: missing signature.");
      return NextResponse.json(
        { success: false, error: "Missing webhook signature." },
        { status: 401 }
      );
    }

    const isValidSignature = verifyPaystackWebhookSignature(
      rawBody,
      signature
    );

    if (!isValidSignature) {
      console.error("Paystack webhook rejected: invalid signature.");
      return NextResponse.json(
        { success: false, error: "Invalid webhook signature." },
        { status: 401 }
      );
    }

    /* ---------------------------------------------------------
     * 3. Parse payload
     * --------------------------------------------------------- */

    let payload: {
      event?: string;
      data?: {
        id?: number | string;
        reference?: string;
        status?: string;
        amount?: number;
        currency?: string;
        paid_at?: string;
        customer?: { email?: string };
      };
    };

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid webhook payload." },
        { status: 400 }
      );
    }

    /* ---------------------------------------------------------
     * 4. Only process charge.success
     *
     * Other events (subscription.create, subscription.disable,
     * subscription.not_renew, invoice.payment_failed, etc.)
     * are acknowledged but not processed here.
     * --------------------------------------------------------- */

    if (payload.event !== "charge.success") {
      return NextResponse.json({
        success: true,
        message: "Event received.",
      });
    }

    /* ---------------------------------------------------------
     * 5. Extract reference
     * --------------------------------------------------------- */

    const reference = payload.data?.reference?.trim();

    if (!reference) {
      console.error("Paystack webhook: missing transaction reference.");
      return NextResponse.json(
        { success: false, error: "Missing transaction reference." },
        { status: 400 }
      );
    }

    /* ---------------------------------------------------------
     * 6. Find local payment
     * --------------------------------------------------------- */

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.reference, reference))
      .limit(1);

    if (!payment) {
      /*
       * We don't create payments from webhook events.
       * Payments must originate from our own initialize endpoint.
       */

      console.error(
        "Paystack webhook: local payment not found:",
        reference
      );

      return NextResponse.json({
        success: true,
        message: "Transaction not recognized.",
      });
    }

    /* ---------------------------------------------------------
     * 7. Already processed? (idempotency guard)
     *
     * DB check constraint allows:
     *   pending | successful | failed | refunded
     * --------------------------------------------------------- */

    if (
      payment.status === "successful" &&
      payment.subscriptionId
    ) {
      return NextResponse.json({
        success: true,
        message: "Payment already processed.",
      });
    }

    /* ---------------------------------------------------------
     * 8. Verify transaction directly with Paystack
     * --------------------------------------------------------- */

    let verification;

    try {
      verification = await verifyTransaction(reference);
    } catch (error) {
      console.error(
        "Paystack webhook verification failed:",
        error instanceof Error ? error.message : error
      );

      /* Return 500 so Paystack retries. */
      return NextResponse.json(
        {
          success: false,
          error: "Transaction verification failed.",
        },
        { status: 500 }
      );
    }

    const transaction = verification.data;

    /* ---------------------------------------------------------
     * 9. Validate transaction
     *
     * validatePaystackPayment expects:
     *   paystackAmount, expectedAmount,
     *   paystackCurrency, expectedCurrency,
     *   paystackStatus
     *
     * It internally normalizes amount to integers, so we don't
     * need to do any conversion here.
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
      console.error(
        "Paystack webhook validation failed:",
        error instanceof Error ? error.message : error,
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

      /*
       * The transaction does not match our expected payment,
       * so retrying will not fix it.
       */

      return NextResponse.json({
        success: true,
        message: "Payment validation failed.",
      });
    }

    /* ---------------------------------------------------------
     * 10. Explicit reference check
     * --------------------------------------------------------- */

    if (transaction.reference !== payment.reference) {
      console.error(
        "Paystack webhook reference mismatch:",
        {
          expected: payment.reference,
          received: transaction.reference,
        }
      );

      await db
        .update(payments)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(payments.id, payment.id));

      return NextResponse.json({
        success: true,
        message: "Reference mismatch.",
      });
    }

    /* ---------------------------------------------------------
     * 11. Mark payment successful
     *
     * DB check constraint allows: pending | successful | failed | refunded
     * Column is provider_transaction_id, NOT paystack_transaction_id.
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
      return NextResponse.json(
        { success: false, error: "Unable to update payment." },
        { status: 500 }
      );
    }

    /* ---------------------------------------------------------
     * 12. Activate subscription
     *
     * activateSubscription() locks the payment row with
     * SELECT ... FOR UPDATE.
     *
     * Therefore callback + webhook cannot create two
     * subscriptions for the same payment.
     * --------------------------------------------------------- */

    try {
      await activateSubscription({
        paymentId: updatedPayment.id,
        userId: updatedPayment.userId,
      });
    } catch (error) {
      console.error(
        "Paystack webhook subscription activation failed:",
        error instanceof Error ? error.message : error
      );

      /*
       * Payment remains SUCCESSFUL.
       * Returning 500 tells Paystack to retry the webhook.
       * activateSubscription() is idempotent, so the retry is safe.
       */

      return NextResponse.json(
        {
          success: false,
          error:
            "Payment received but subscription activation is pending.",
        },
        { status: 500 }
      );
    }

    /* ---------------------------------------------------------
     * 13. Success
     * --------------------------------------------------------- */

    return NextResponse.json({
      success: true,
      message: "Payment processed successfully.",
    });
  } catch (error) {
    console.error(
      "Paystack webhook error:",
      error instanceof Error ? error.message : error,
      error instanceof Error ? error.stack : undefined
    );

    /* Return 500 so Paystack retries the event. */
    return NextResponse.json(
      { success: false, error: "Webhook processing failed." },
      { status: 500 }
    );
  }
}