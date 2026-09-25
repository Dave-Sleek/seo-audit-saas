// app/lib/audit-events.ts

import type { AuditSeverity } from "@/app/lib/audit-log";

/* =========================================================
   EVENT DISPLAY
========================================================= */

type EventDisplay = {
  label: string;
  description: string;
  icon: "shield" | "check" | "warning" | "alert" | "login" | "logout";
  defaultSeverity: AuditSeverity;
};

const EVENT_DISPLAY: Record<string, EventDisplay> = {
  /* ---------- Auth ---------- */
  "auth.login.success": {
    label: "Signed in",
    description: "Successful login to your account.",
    icon: "login",
    defaultSeverity: "info",
  },
  "auth.login.failed": {
    label: "Failed sign-in attempt",
    description:
      "Someone tried to sign in with your email but the credentials were incorrect.",
    icon: "warning",
    defaultSeverity: "warning",
  },
  "auth.password.reset_requested": {
    label: "Password reset requested",
    description:
      "A password reset link was requested for your account.",
    icon: "warning",
    defaultSeverity: "warning",
  },
  "auth.password.reset_completed": {
    label: "Password changed",
    description:
      "Your password was reset via the reset link. You were signed out everywhere.",
    icon: "warning",
    defaultSeverity: "warning",
  },
  "auth.email_verified": {
    label: "Email verified",
    description:
      "The email address on your account was confirmed.",
    icon: "check",
    defaultSeverity: "info",
  },

  /* ---------- 2FA ---------- */
  "auth.2fa.enabled": {
    label: "Two-factor authentication enabled",
    description:
      "An extra security step was added to your sign-in.",
    icon: "shield",
    defaultSeverity: "info",
  },
  "auth.2fa.disabled": {
    label: "Two-factor authentication disabled",
    description:
      "The second step at sign-in was removed. If you didn't do this, secure your account immediately.",
    icon: "alert",
    defaultSeverity: "critical",
  },
  "auth.2fa.challenge_failed": {
    label: "Failed 2FA verification",
    description:
      "A two-factor code was entered incorrectly during sign-in.",
    icon: "warning",
    defaultSeverity: "warning",
  },
  "auth.2fa.recovery_code_used": {
    label: "Recovery code used",
    description:
      "A backup recovery code was used to sign in. Used codes can't be reused.",
    icon: "warning",
    defaultSeverity: "warning",
  },

  /* ---------- Account ---------- */
  "account.registered": {
    label: "Account created",
    description: "Your account was created.",
    icon: "check",
    defaultSeverity: "info",
  },
  "account.profile_updated": {
    label: "Profile updated",
    description: "Your account details were changed.",
    icon: "check",
    defaultSeverity: "info",
  },
  "account.deleted": {
    label: "Account deleted",
    description: "Your account was deleted.",
    icon: "alert",
    defaultSeverity: "critical",
  },

  /* ---------- Billing ---------- */
  "billing.subscription.activated": {
    label: "Subscription activated",
    description: "A new subscription was activated.",
    icon: "check",
    defaultSeverity: "info",
  },
  "billing.subscription.cancelled": {
    label: "Subscription cancelled",
    description:
      "Auto-renewal was turned off. Access continues until the end of the current period.",
    icon: "info" as never, // placeholder, overridden below
    defaultSeverity: "info",
  },
  "billing.subscription.plan_changed": {
    label: "Plan changed",
    description: "Your subscription was changed to a different plan.",
    icon: "check",
    defaultSeverity: "info",
  },
  "billing.payment.succeeded": {
    label: "Payment succeeded",
    description: "A payment was received for your subscription.",
    icon: "check",
    defaultSeverity: "info",
  },
  "billing.payment.failed": {
    label: "Payment failed",
    description:
      "A payment for your subscription was declined. Update your payment method to avoid interruption.",
    icon: "warning",
    defaultSeverity: "warning",
  },

  /* ---------- Admin ---------- */
  "admin.login.success": {
    label: "Admin signed in",
    description: "An admin signed in.",
    icon: "login",
    defaultSeverity: "info",
  },
  "admin.action": {
    label: "Admin action",
    description: "An administrative action was performed.",
    icon: "warning",
    defaultSeverity: "info",
  },
};

const FALLBACK_DISPLAY: EventDisplay = {
  label: "Account activity",
  description: "An activity was recorded on your account.",
  icon: "check",
  defaultSeverity: "info",
};

export function getEventDisplay(eventType: string): EventDisplay {
  return EVENT_DISPLAY[eventType] ?? FALLBACK_DISPLAY;
}