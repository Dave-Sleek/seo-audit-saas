import crypto from "crypto";

const PAYSTACK_BASE_URL =
  "https://api.paystack.co";

/**
 * ============================================================
 * TYPES
 * ============================================================
 */

export type PaystackCustomer = {
  id: number;
  email: string;
  customer_code: string;
  first_name: string | null;
  last_name: string | null;
};

export type PaystackAuthorization = {
  authorization_code: string;
  bin: string | null;
  last4: string | null;
  exp_month: string | null;
  exp_year: string | null;
  channel: string | null;
  card_type: string | null;
  bank: string | null;
  country_code: string | null;
  brand: string | null;
  reusable: boolean;
};

export type PaystackPlan = {
  name: string;
  plan_code: string;
  amount: number;
  interval: string;
};

export type PaystackInitializeResponse = {
  status: boolean;
  message: string;

  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
};

export type PaystackVerifyResponse = {
  status: boolean;
  message: string;

  data: {
    id: number;
    domain: string;
    status: string;
    reference: string;

    amount: number;
    currency: string;

    transaction_date: string;
    paid_at: string | null;

    channel: string | null;
    ip_address: string | null;
    fees: number | null;

    customer?: PaystackCustomer;

    authorization?: PaystackAuthorization;

    plan?: PaystackPlan | null;

    metadata?: Record<
      string,
      unknown
    >;
  };
};

/**
 * ============================================================
 * ENVIRONMENT
 * ============================================================
 */

function getPaystackSecretKey(): string {
  const key =
    process.env.PAYSTACK_SECRET_KEY;

  if (!key) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is not configured."
    );
  }

  return key;
}

/**
 * ============================================================
 * GENERIC PAYSTACK REQUEST
 * ============================================================
 */

async function paystackRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const secretKey =
    getPaystackSecretKey();

  const response = await fetch(
    `${PAYSTACK_BASE_URL}${endpoint}`,
    {
      ...options,

      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type":
          "application/json",

        ...(options.headers || {}),
      },

      cache: "no-store",
    }
  );

  let data: any;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Paystack returned an invalid response (${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        `Paystack request failed with status ${response.status}.`
    );
  }

  if (!data?.status) {
    throw new Error(
      data?.message ||
        "Paystack request was unsuccessful."
    );
  }

  return data as T;
}

/**
 * ============================================================
 * INITIALIZE TRANSACTION
 * ============================================================
 *
 * Paystack expects the amount in the smallest
 * currency unit.
 *
 * Example:
 *
 * ₦5,000
 * =
 * 500000 kobo
 *
 * For recurring subscriptions, pass the
 * Paystack plan code.
 *
 * IMPORTANT:
 *
 * When a plan code is supplied, Paystack uses
 * the amount configured on the Paystack plan.
 *
 * Therefore the local plan amount should always
 * match the Paystack plan amount.
 */
export type InitializeTransactionParams = {
  email: string;

  amount: number;

  currency?: string;

  reference: string;

  callbackUrl: string;

  metadata?: Record<
    string,
    unknown
  >;

  planCode?: string;

  invoiceLimit?: number;
};

export async function initializeTransaction(
  params: InitializeTransactionParams
): Promise<PaystackInitializeResponse> {
  if (!params.email) {
    throw new Error(
      "Customer email is required."
    );
  }

  if (
    !Number.isInteger(params.amount) ||
    params.amount <= 0
  ) {
    throw new Error(
      "Transaction amount must be a positive integer."
    );
  }

  if (!params.reference) {
    throw new Error(
      "Transaction reference is required."
    );
  }

  if (!params.callbackUrl) {
    throw new Error(
      "Callback URL is required."
    );
  }

  const body: Record<
    string,
    unknown
  > = {
    email: params.email,

    amount: String(
      params.amount
    ),

    currency:
      params.currency || "NGN",

    reference:
      params.reference,

    callback_url:
      params.callbackUrl,
  };

  /**
   * Paystack expects metadata as a
   * stringified JSON value.
   */
  if (params.metadata) {
    body.metadata =
      JSON.stringify(
        params.metadata
      );
  }

  /**
   * Add Paystack recurring plan
   * when supplied.
   */
  if (params.planCode) {
    body.plan =
      params.planCode;
  }

  /**
   * Optional recurring invoice limit.
   */
  if (
    params.invoiceLimit !==
      undefined &&
    Number.isInteger(
      params.invoiceLimit
    ) &&
    params.invoiceLimit > 0
  ) {
    body.invoice_limit =
      params.invoiceLimit;
  }

  return paystackRequest<PaystackInitializeResponse>(
    "/transaction/initialize",
    {
      method: "POST",

      body: JSON.stringify(
        body
      ),
    }
  );
}

/**
 * ============================================================
 * VERIFY TRANSACTION
 * ============================================================
 *
 * This is used by the payment callback.
 *
 * Never activate a subscription merely
 * because the customer returned to the
 * callback URL.
 *
 * Always verify the reference directly
 * with Paystack first.
 */
export async function verifyTransaction(
  reference: string
): Promise<PaystackVerifyResponse> {
  if (!reference) {
    throw new Error(
      "Transaction reference is required."
    );
  }

  return paystackRequest<PaystackVerifyResponse>(
    `/transaction/verify/${encodeURIComponent(
      reference
    )}`,
    {
      method: "GET",
    }
  );
}

/**
 * ============================================================
 * WEBHOOK SIGNATURE VERIFICATION
 * ============================================================
 *
 * Paystack signs webhook requests with
 * HMAC SHA512 using the secret key.
 *
 * IMPORTANT:
 *
 * This function expects the RAW request
 * body, not JSON.stringify(parsedBody).
 */
export function verifyPaystackWebhookSignature(
  payload: string,
  signature: string | null
): boolean {
  if (!signature) {
    return false;
  }

  const secretKey =
    getPaystackSecretKey();

  const expectedSignature =
    crypto
      .createHmac(
        "sha512",
        secretKey
      )
      .update(payload)
      .digest("hex");

  const expectedBuffer =
    Buffer.from(
      expectedSignature,
      "utf8"
    );

  const receivedBuffer =
    Buffer.from(
      signature,
      "utf8"
    );

  /**
   * Avoid timingSafeEqual throwing
   * when buffer lengths differ.
   */
  if (
    expectedBuffer.length !==
    receivedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer
  );
}

/**
 * ============================================================
 * PAYMENT SUCCESS VALIDATION
 * ============================================================
 *
 * Centralized validation so both the
 * callback and webhook processing can
 * use the same rules.
 */
export type ValidatePaymentParams = {
  paystackAmount: number;

  expectedAmount: number;

  paystackCurrency: string;

  expectedCurrency: string;

  paystackStatus: string;
};

export function validatePaystackPayment(
  params: ValidatePaymentParams
): void {
  if (
    params.paystackStatus !==
    "success"
  ) {
    throw new Error(
      `Paystack transaction is not successful. Status: ${params.paystackStatus}`
    );
  }

  if (
    params.paystackAmount !==
    params.expectedAmount
  ) {
    throw new Error(
      "Paystack payment amount does not match the expected amount."
    );
  }

  if (
    params.paystackCurrency.toUpperCase() !==
    params.expectedCurrency.toUpperCase()
  ) {
    throw new Error(
      "Paystack payment currency does not match the expected currency."
    );
  }
}

/**
 * ============================================================
 * GENERATE PAYMENT REFERENCE
 * ============================================================
 *
 * Example:
 *
 * SUB_9f2a4d7c8b1e
 *
 * Paystack references may contain
 * alphanumeric characters plus -, ., =
 * according to the API documentation.
 */
export function generatePaymentReference(): string {
  return `SUB_${crypto
    .randomBytes(12)
    .toString("hex")}`;
}

/**
 * ============================================================
 * APP URL
 * ============================================================
 */

export function getAppUrl(): string {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is not configured."
    );
  }

  return appUrl.replace(
    /\/$/,
    ""
  );
}

/**
 * ============================================================
 * PAYMENT CALLBACK URL
 * ============================================================
 */

export function getPaymentCallbackUrl(): string {
  return `${getAppUrl()}/api/payments/callback`;
}

/**
 * ============================================================
 * PAYMENT WEBHOOK URL
 * ============================================================
 */

export function getPaymentWebhookUrl(): string {
  return `${getAppUrl()}/api/payments/webhook`;
}