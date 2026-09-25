// app/lib/email/send.ts

import { resend, FROM_EMAIL, APP_URL } from "./client";
import { WelcomeEmail } from "./templates/welcome";
import { ResetPasswordEmail } from "./templates/reset-password";
import { TwoFactorCodeEmail } from "./templates/two-factor-code";
import { VerifyEmail } from "./templates/verify-email";
import { TicketCreatedEmail } from "./templates/support-ticket-created";
import { TicketAdminNotifyEmail } from "./templates/support-ticket-admin-notify";
import { TicketReplyEmail } from "./templates/support-ticket-reply";
import { ProjectInviteEmail } from "./templates/project-invite";
import { ContactReplyEmail } from "./templates/contact-reply";

/* =========================================================
   LOGGING HELPERS
========================================================= */

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

  const emailSubject = "Welcome to SEO Audit";

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: emailSubject,
      react: WelcomeEmail({
        name: params.name,
        loginUrl: `${APP_URL}/dashboard`,
      }),
    });

    if (error) {
      logSendFailure("welcome send", { to: params.to, subject: emailSubject }, error);
      return false;
    }

    console.log("[email] welcome sent", {
      to: params.to,
      id: data?.id,
    });
    return true;
  } catch (err) {
    logSendFailure("welcome send (threw)", { to: params.to, subject: emailSubject }, err);
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

  const emailSubject = "Reset your password";

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: emailSubject,
      react: ResetPasswordEmail({
        name: params.name,
        resetUrl,
      }),
    });

    if (error) {
      logSendFailure(
        "reset send",
        { to: params.to, subject: emailSubject },
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
      { to: params.to, subject: emailSubject },
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

  const emailSubject = "Your verification code";

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: emailSubject,
      react: TwoFactorCodeEmail({
        name: params.name,
        code: params.code,
      }),
    });

    if (error) {
      logSendFailure(
        "2FA code send",
        { to: params.to, subject: emailSubject },
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
      { to: params.to, subject: emailSubject },
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

  const verifyUrl = `${APP_URL}/verify-email/confirm?token=${encodeURIComponent(
    params.token
  )}`;

  const emailSubject = "Verify your email";

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: emailSubject,
      react: VerifyEmail({
        name: params.name,
        verifyUrl,
      }),
    });

    if (error) {
      logSendFailure(
        "verification send",
        { to: params.to, subject: emailSubject },
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
      { to: params.to, subject: emailSubject },
      err
    );
    return false;
  }
}

/* =========================================================
   SUPPORT — TICKET CREATED (to user)
========================================================= */

export async function sendTicketCreatedEmail(params: {
  to: string;
  name?: string | null;
  reference: string;
  subject: string;
  ticketId: string;
}): Promise<boolean> {
  if (!resend) {
    console.warn(
      "[email] sendTicketCreatedEmail skipped: Resend client not configured"
    );
    return false;
  }

  const emailSubject = `[${params.reference}] We received your support ticket`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: emailSubject,
      react: TicketCreatedEmail({
        name: params.name,
        reference: params.reference,
        subject: params.subject,
        ticketUrl: `${APP_URL}/dashboard/support/${params.ticketId}`,
      }),
    });

    if (error) {
      logSendFailure(
        "ticket-created send",
        { to: params.to, subject: emailSubject },
        error
      );
      return false;
    }

    console.log("[email] ticket-created sent", {
      to: params.to,
      id: data?.id,
    });
    return true;
  } catch (err) {
    logSendFailure(
      "ticket-created send (threw)",
      { to: params.to, subject: emailSubject },
      err
    );
    return false;
  }
}

/* =========================================================
   SUPPORT — NEW TICKET (to admin)
========================================================= */

export async function sendTicketAdminNotifyEmail(params: {
  to: string;
  reference: string;
  subject: string;
  category: string;
  priority: string;
  body: string;
  userEmail: string;
  userName?: string | null;
  ticketId: string;
}): Promise<boolean> {
  if (!resend) {
    console.warn(
      "[email] sendTicketAdminNotifyEmail skipped: Resend client not configured"
    );
    return false;
  }

  const emailSubject = `[${params.reference}] New ${params.priority} support ticket — ${params.subject}`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: emailSubject,
      react: TicketAdminNotifyEmail({
        reference: params.reference,
        subject: params.subject,
        category: params.category,
        priority: params.priority,
        body: params.body,
        userEmail: params.userEmail,
        userName: params.userName,
        ticketUrl: `${APP_URL}/dashboard/admin/support/${params.ticketId}`,
      }),
    });

    if (error) {
      logSendFailure(
        "ticket-admin-notify send",
        { to: params.to, subject: emailSubject },
        error
      );
      return false;
    }

    console.log("[email] ticket-admin-notify sent", {
      to: params.to,
      id: data?.id,
    });
    return true;
  } catch (err) {
    logSendFailure(
      "ticket-admin-notify send (threw)",
      { to: params.to, subject: emailSubject },
      err
    );
    return false;
  }
}

/* =========================================================
   SUPPORT — ADMIN REPLIED (to user)
========================================================= */

export async function sendTicketReplyEmail(params: {
  to: string;
  name?: string | null;
  reference: string;
  subject: string;
  replyBody: string;
  ticketId: string;
  newStatus: "open" | "pending" | "resolved";
}): Promise<boolean> {
  if (!resend) {
    console.warn(
      "[email] sendTicketReplyEmail skipped: Resend client not configured"
    );
    return false;
  }

  const emailSubject = `[${params.reference}] New reply from support`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: emailSubject,
      react: TicketReplyEmail({
        name: params.name,
        reference: params.reference,
        subject: params.subject,
        replyBody: params.replyBody,
        ticketUrl: `${APP_URL}/dashboard/support/${params.ticketId}`,
        newStatus: params.newStatus,
      }),
    });

    if (error) {
      logSendFailure(
        "ticket-reply send",
        { to: params.to, subject: emailSubject },
        error
      );
      return false;
    }

    console.log("[email] ticket-reply sent", {
      to: params.to,
      id: data?.id,
    });
    return true;
  } catch (err) {
    logSendFailure(
      "ticket-reply send (threw)",
      { to: params.to, subject: emailSubject },
      err
    );
    return false;
  }
}


/* =========================================================
   PROJECT INVITE
========================================================= */

export async function sendProjectInviteEmail(params: {
  to: string;
  inviterName: string | null;
  projectName: string;
  projectDomain: string;
  token: string;
}): Promise<boolean> {
  if (!resend) {
    console.warn(
      "[email] sendProjectInviteEmail skipped: Resend not configured"
    );
    return false;
  }

  const inviteUrl = `${APP_URL}/dashboard/invitations/${params.token}`;
  const emailSubject = `You've been invited to ${params.projectName}`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: emailSubject,
      react: ProjectInviteEmail({
        inviterName: params.inviterName,
        projectName: params.projectName,
        projectDomain: params.projectDomain,
        inviteUrl,
      }),
    });

    if (error) {
      logSendFailure(
        "project-invite send",
        { to: params.to, subject: emailSubject },
        error
      );
      return false;
    }

    console.log("[email] project-invite sent", {
      to: params.to,
      id: data?.id,
    });
    return true;
  } catch (err) {
    logSendFailure(
      "project-invite send (threw)",
      { to: params.to, subject: emailSubject },
      err
    );
    return false;
  }
}


/* =========================================================
   CONTACT — REPLY TO SENDER
========================================================= */

export async function sendContactReplyEmail(params: {
  to: string;
  name: string | null;
  subject: string;
  originalMessage: string;
  replyBody: string;
  messageId: string;
}): Promise<boolean> {
  if (!resend) {
    console.warn(
      "[email] sendContactReplyEmail skipped: Resend not configured"
    );
    return false;
  }

  const replyUrl = `${APP_URL}/contact`;
  const emailSubject = `Re: ${params.subject}`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: emailSubject,
      react: ContactReplyEmail({
        name: params.name,
        subject: params.subject,
        originalMessage: params.originalMessage,
        replyBody: params.replyBody,
        replyUrl,
      }),
    });

    if (error) {
      logSendFailure(
        "contact-reply send",
        { to: params.to, subject: emailSubject },
        error
      );
      return false;
    }

    console.log("[email] contact-reply sent", {
      to: params.to,
      id: data?.id,
    });
    return true;
  } catch (err) {
    logSendFailure(
      "contact-reply send (threw)",
      { to: params.to, subject: emailSubject },
      err
    );
    return false;
  }
}