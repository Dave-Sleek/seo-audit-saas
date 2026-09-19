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

export async function GET(
  request: NextRequest
) {
  const appUrl = getAppUrl();

  try {
    /*
     * ---------------------------------------------------------
     * 1. Get Paystack reference
     * ---------------------------------------------------------
     */

    const reference =
      request.nextUrl.searchParams
        .get("reference")
        ?.trim();

    if (!reference) {
      return NextResponse.redirect(
        new URL(
          "/dashboard/pricing?payment=missing_reference",
          appUrl
        )
      );
    }

    /*
     * ---------------------------------------------------------
     * 2. Find local payment
     * ---------------------------------------------------------
     */

    const [payment] =
      await db
        .select()
        .from(payments)
        .where(
          eq(
            payments.reference,
            reference
          )
        )
        .limit(1);

    if (!payment) {
      console.error(
        "Paystack callback: payment not found:",
        reference
      );

      return NextResponse.redirect(
        new URL(
          "/dashboard/pricing?payment=not_found",
          appUrl
        )
      );
    }

    /*
     * ---------------------------------------------------------
     * 3. Already completely processed?
     * ---------------------------------------------------------
     */

    if (
      payment.status === "success" &&
      payment.subscriptionId
    ) {
      return NextResponse.redirect(
        new URL(
          "/dashboard/subscription?payment=success",
          appUrl
        )
      );
    }

    /*
     * ---------------------------------------------------------
     * 4. Verify transaction with Paystack
     * ---------------------------------------------------------
     */

    let verification;

    try {
      verification =
        await verifyTransaction(
          reference
        );
    } catch (error) {
      console.error(
        "Paystack callback verification failed:",
        error
      );

      return NextResponse.redirect(
        new URL(
          "/dashboard/pricing?payment=verification_failed",
          appUrl
        )
      );
    }

    const transaction =
      verification.data;

    /*
     * ---------------------------------------------------------
     * 5. Validate transaction
     * ---------------------------------------------------------
     */

    try {
      validatePaystackPayment({
        data: transaction,
        expectedAmount: payment.amount,
        // expectedAmount: Math.round(
        //   Number(payment.amount) * 100
        // ),
        expectedCurrency:
          payment.currency,
        expectedReference:
          payment.reference,
      });
    } catch (error) {
      console.error(
        "Paystack callback validation failed:",
        error
      );

      await db
        .update(payments)
        .set({
          status: "failed",
          updatedAt: new Date(),
        })
        .where(
          eq(
            payments.id,
            payment.id
          )
        );

      return NextResponse.redirect(
        new URL(
          "/dashboard/pricing?payment=validation_failed",
          appUrl
        )
      );
    }

    /*
     * ---------------------------------------------------------
     * 6. Explicit reference validation
     * ---------------------------------------------------------
     */

    if (
      transaction.reference !==
      payment.reference
    ) {
      console.error(
        "Paystack callback reference mismatch:",
        {
          expected:
            payment.reference,
          received:
            transaction.reference,
        }
      );

      await db
        .update(payments)
        .set({
          status: "failed",
          updatedAt: new Date(),
        })
        .where(
          eq(
            payments.id,
            payment.id
          )
        );

      return NextResponse.redirect(
        new URL(
          "/dashboard/pricing?payment=reference_mismatch",
          appUrl
        )
      );
    }

    /*
     * ---------------------------------------------------------
     * 7. Mark payment successful
     * ---------------------------------------------------------
     *
     * This update is safe because subscription activation is
     * protected by a payment-row lock.
     */

    const [updatedPayment] =
      await db
        .update(payments)
        .set({
          status: "success",
          paidAt: transaction.paid_at
            ? new Date(
                transaction.paid_at
              )
            : new Date(),
          paystackTransactionId:
            transaction.id !==
            undefined
              ? String(
                  transaction.id
                )
              : payment.paystackTransactionId,
          updatedAt: new Date(),
        })
        .where(
          eq(
            payments.id,
            payment.id
          )
        )
        .returning();

    if (!updatedPayment) {
      return NextResponse.redirect(
        new URL(
          "/dashboard/pricing?payment=processing_error",
          appUrl
        )
      );
    }

    /*
     * ---------------------------------------------------------
     * 8. Activate subscription
     * ---------------------------------------------------------
     *
     * The subscription service handles concurrency and
     * idempotency using SELECT ... FOR UPDATE.
     */

    try {
      await activateSubscription({
        paymentId:
          updatedPayment.id,
        userId:
          updatedPayment.userId,
      });
    } catch (error) {
      console.error(
        "Paystack callback subscription activation failed:",
        error
      );

      /*
       * Payment remains SUCCESS.
       *
       * Webhook/retry can safely complete activation.
       */

      return NextResponse.redirect(
        new URL(
          "/dashboard/pricing?payment=activation_pending",
          appUrl
        )
      );
    }

    /*
     * ---------------------------------------------------------
     * 9. Success
     * ---------------------------------------------------------
     */

    return NextResponse.redirect(
      new URL(
        "/dashboard/subscription?payment=success",
        appUrl
      )
    );
  } catch (error) {
    console.error(
      "Paystack callback error:",
      error
    );

    return NextResponse.redirect(
      new URL(
        "/dashboard/pricing?payment=error",
        appUrl
      )
    );
  }
}