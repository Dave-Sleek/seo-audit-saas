import { resend, FROM_EMAIL, APP_URL } from "./client";
import { WelcomeEmail } from "./templates/welcome";
import { ResetPasswordEmail } from "./templates/reset-password";
import { TwoFactorCodeEmail } from "./templates/two-factor-code";
import { VerifyEmail } from "./templates/verify-email";

/* =========================================================
   LOGGING HELPERS
========================================================= */

/**
 * One-time startup log so you can see, at a glance, whether
 * the Resend client and env vars are configured correctly.
 * Runs once per process because module state is cached.
 */
if (typeof process !== "undefined") {
  const g = globalThis as typeof globalThis & {
    __resendStartupLogged?: boolean;
  };

  if (!g.__resendStartupLogged) {
    g.__resendStartupLogged = true;

    console.log("[email] Resend config", {
      clientInitialized: Boolean(resend),
      hasApiKey: Boolean(process.env.RESEND_API_KEY),
      apiKeyPrefix: process.env.RESEND_API_KEY?.slice(0, 5),
      from: FROM_EMAIL,
      appUrl: APP_URL,
    });
  }
}

/**
 * Log a Resend failure with enough context to diagnose it.
 *
 * Resend's error object shape varies:
 *   - { name, statusCode, message }         // API-level error
 *   - { message }                            // generic
 *   - undefined                              // the send threw before returning
 */
function logSendFailure(
  context: string,
  params: { to: string; subject: string },
  error: unknown
) {
  console.error(`[email] ${context} failed`, {
    to: params.to,
    subject: params.subject,
    from: FROM_EMAIL,
    error,
    errorName:
      error && typeof error === "object" && "name" in error
        ? (error as { name?: string }).name
        : undefined,
    errorStatus:
      error && typeof error === "object" && "statusCode" in error
        ? (error as { statusCode?: number | null }).statusCode
        : undefined,
    errorMessage:
      error && typeof error === "object" && "message" in error
        ? (error as { message?: string }).message
        : undefined,
  });
}

/* =========================================================
   WELCOME EMAIL
========================================================= */

export async function sendWelcomeEmail(params: {
  to: string;
  name: string;
}): Promise<boolean> {
  if (!resend) {
    console.warn(
      "[email] sendWelcomeEmail skipped: Resend client not configured"
    );
    return false;
  }

  const subject = "Welcome to SEO Audit";

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject,
      react: WelcomeEmail({
        name: params.name,
        loginUrl: `${APP_URL}/dashboard`,
      }),
    });

    if (error) {
      logSendFailure("welcome send", { to: params.to, subject }, error);
      return false;
    }

    console.log("[email] welcome sent", {
      to: params.to,
      id: data?.id,
    });
    return true;
  } catch (err) {
    logSendFailure("welcome send (threw)", { to: params.to, subject }, err);
    return false;
  }
}

/* =========================================================
   RESET PASSWORD EMAIL
========================================================= */

export async function sendResetPasswordEmail(params: {
  to: string;
  name: string;
  token: string;
}): Promise<boolean> {
  if (!resend) {
    console.warn(
      "[email] sendResetPasswordEmail skipped: Resend client not configured"
    );
    return false;
  }

  const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(
    params.token
  )}`;

  const subject = "Reset your password";

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject,
      react: ResetPasswordEmail({
        name: params.name,
        resetUrl,
      }),
    });

    if (error) {
      logSendFailure(
        "reset send",
        { to: params.to, subject },
        error
      );
      return false;
    }

    console.log("[email] reset email sent", {
      to: params.to,
      id: data?.id,
    });
    return true;
  } catch (err) {
    logSendFailure(
      "reset send (threw)",
      { to: params.to, subject },
      err
    );
    return false;
  }
}

/* =========================================================
   TWO-FACTOR CODE EMAIL
========================================================= */

export async function sendTwoFactorCodeEmail(params: {
  to: string;
  name: string;
  code: string;
}): Promise<boolean> {
  if (!resend) {
    console.warn(
      "[email] sendTwoFactorCodeEmail skipped: Resend client not configured"
    );
    return false;
  }

  const subject = "Your verification code";

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject,
      react: TwoFactorCodeEmail({
        name: params.name,
        code: params.code,
      }),
    });

    if (error) {
      logSendFailure(
        "2FA code send",
        { to: params.to, subject },
        error
      );
      return false;
    }

    console.log("[email] 2FA code sent", {
      to: params.to,
      id: data?.id,
    });
    return true;
  } catch (err) {
    logSendFailure(
      "2FA code send (threw)",
      { to: params.to, subject },
      err
    );
    return false;
  }
}

/* =========================================================
   EMAIL VERIFICATION
========================================================= */

export async function sendVerificationEmail(params: {
  to: string;
  name: string;
  token: string;
}): Promise<boolean> {
  if (!resend) {
    console.warn(
      "[email] sendVerificationEmail skipped: Resend not configured"
    );
    return false;
  }

  /*
   * The link points at the API route, not a page. When the
   * user clicks, the route validates the token, marks the
   * email as verified, and redirects to the dashboard.
   */
  const verifyUrl = `${APP_URL}/verify-email/confirm?token=${encodeURIComponent(
  params.token
  )}`;

  const subject = "Verify your email";

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject,
      react: VerifyEmail({
        name: params.name,
        verifyUrl,
      }),
    });

    if (error) {
      logSendFailure(
        "verification send",
        { to: params.to, subject },
        error
      );
      return false;
    }

    console.log("[email] verification sent", {
      to: params.to,
      id: data?.id,
    });
    return true;
  } catch (err) {
    logSendFailure(
      "verification send (threw)",
      { to: params.to, subject },
      err
    );
    return false;
  }
}