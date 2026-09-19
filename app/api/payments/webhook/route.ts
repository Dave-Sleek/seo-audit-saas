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

export async function POST(
  request: NextRequest
) {
  try {
    /*
     * ---------------------------------------------------------
     * 1. Read raw body
     * ---------------------------------------------------------
     *
     * Required for Paystack HMAC signature verification.
     */

    const rawBody =
      await request.text();

    if (!rawBody) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Empty webhook body.",
        },
        { status: 400 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 2. Verify Paystack signature
     * ---------------------------------------------------------
     */

    const signature =
      request.headers.get(
        "x-paystack-signature"
      );

    if (!signature) {
      console.error(
        "Paystack webhook rejected: missing signature."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Missing webhook signature.",
        },
        { status: 401 }
      );
    }

    const isValidSignature =
      verifyPaystackWebhookSignature(
        rawBody,
        signature
      );

    if (!isValidSignature) {
      console.error(
        "Paystack webhook rejected: invalid signature."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid webhook signature.",
        },
        { status: 401 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 3. Parse payload
     * ---------------------------------------------------------
     */

    let payload: {
      event?: string;
      data?: {
        id?: number | string;
        reference?: string;
        status?: string;
        amount?: number;
        currency?: string;
        paid_at?: string;
        customer?: {
          email?: string;
        };
      };
    };

    try {
      payload =
        JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid webhook payload.",
        },
        { status: 400 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 4. Only process charge.success
     * ---------------------------------------------------------
     */

    if (
      payload.event !==
      "charge.success"
    ) {
      return NextResponse.json({
        success: true,
        message:
          "Event received.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 5. Get reference
     * ---------------------------------------------------------
     */

    const reference =
      payload.data?.reference?.trim();

    if (!reference) {
      console.error(
        "Paystack webhook: missing transaction reference."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Missing transaction reference.",
        },
        { status: 400 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 6. Find local payment
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
        "Paystack webhook: local payment not found:",
        reference
      );

      /*
       * We don't create payments from webhook events.
       *
       * Payments must originate from our own initialize
       * endpoint.
       */

      return NextResponse.json({
        success: true,
        message:
          "Transaction not recognized.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 7. Already completely processed?
     * ---------------------------------------------------------
     */

    if (
      payment.status === "success" &&
      payment.subscriptionId
    ) {
      return NextResponse.json({
        success: true,
        message:
          "Payment already processed.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 8. Verify transaction directly with Paystack
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
        "Paystack webhook verification failed:",
        error
      );

      /*
       * Return 500 so Paystack can retry.
       */

      return NextResponse.json(
        {
          success: false,
          error:
            "Transaction verification failed.",
        },
        { status: 500 }
      );
    }

    const transaction =
      verification.data;

    /*
     * ---------------------------------------------------------
     * 9. Validate transaction
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
        "Paystack webhook validation failed:",
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

      /*
       * The transaction does not match our expected payment,
       * so retrying will not fix it.
       */

      return NextResponse.json({
        success: true,
        message:
          "Payment validation failed.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 10. Explicit reference check
     * ---------------------------------------------------------
     */

    if (
      transaction.reference !==
      payment.reference
    ) {
      console.error(
        "Paystack webhook reference mismatch:",
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

      return NextResponse.json({
        success: true,
        message:
          "Reference mismatch.",
      });
    }

    /*
     * ---------------------------------------------------------
     * 11. Mark payment successful
     * ---------------------------------------------------------
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
      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to update payment.",
        },
        { status: 500 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 12. Activate subscription
     * ---------------------------------------------------------
     *
     * activateSubscription() locks the payment row with
     * SELECT ... FOR UPDATE.
     *
     * Therefore callback + webhook cannot create two
     * subscriptions for the same payment.
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
        "Paystack webhook subscription activation failed:",
        error
      );

      /*
       * Payment remains SUCCESS.
       *
       * Returning 500 tells Paystack to retry the webhook.
       *
       * When the retry arrives, activateSubscription() will
       * safely continue because it is idempotent.
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

    /*
     * ---------------------------------------------------------
     * 13. Success
     * ---------------------------------------------------------
     */

    return NextResponse.json({
      success: true,
      message:
        "Payment processed successfully.",
    });
  } catch (error) {
    console.error(
      "Paystack webhook error:",
      error
    );

    /*
     * Return 500 so Paystack can retry the event.
     */

    return NextResponse.json(
      {
        success: false,
        error:
          "Webhook processing failed.",
      },
      { status: 500 }
    );
  }
}