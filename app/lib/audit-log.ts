import { db } from "@/app/db";
import { auditLog } from "@/app/db/schema";

/* =========================================================
   TYPES
========================================================= */

export type AuditEventType =
  // Auth
  | "auth.login.success"
  | "auth.login.failed"
  | "auth.logout"
  | "auth.password.reset_requested"
  | "auth.password.reset_completed"
  | "auth.password.changed"
  | "auth.email_verified"
  // 2FA
  | "auth.2fa.enabled"
  | "auth.2fa.disabled"
  | "auth.2fa.challenge_failed"
  | "auth.2fa.recovery_code_used"
  // Account
  | "account.registered"
  | "account.profile_updated"
  | "account.email_changed"
  | "account.deleted"
  // Billing
  | "billing.subscription.activated"
  | "billing.subscription.cancelled"
  | "billing.subscription.plan_changed"
  | "billing.payment.succeeded"
  | "billing.payment.failed"
  // Admin
  | "admin.login.success"
  | "admin.action"
  // Support
  | "support.ticket.created"
  | "support.ticket.replied"
  | "support.ticket.admin_replied"
  | "support.ticket.status_changed"
  | "support.ticket.priority_changed";

export type AuditSeverity = "info" | "warning" | "critical";

export type LogAuditEventInput = {
  /**
   * The user the event is *about*.
   * - For a login attempt, this is the account being logged into.
   * - For an admin action, this is the user being acted upon.
   * - Nullable for events like "login failed for unknown email".
   */
  userId: string | null;

  /**
   * The user who *performed* the action.
   * - For self-service actions (login, password change), same as userId.
   * - For admin actions, the admin's id, with userId being the target.
   * - Nullable for unauthenticated events.
   */
  actorId?: string | null;

  eventType: AuditEventType;
  severity?: AuditSeverity;

  ipAddress?: string | null;
  userAgent?: string | null;

  metadata?: Record<string, unknown>;
};

/* =========================================================
   LOG
========================================================= */

/**
 * Write an audit log entry.
 *
 * Never throws — a broken audit log must not break the
 * calling action (login, password change, etc.). Failures
 * are logged to stderr so you can spot them.
 */
export async function logAuditEvent(
  input: LogAuditEventInput
): Promise<void> {
  try {
    await db.insert(auditLog).values({
      userId: input.userId,
      actorId: input.actorId ?? input.userId,
      eventType: input.eventType,
      severity: input.severity ?? "info",
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (err) {
    console.error("[audit-log] failed to write entry", {
      eventType: input.eventType,
      userId: input.userId,
      error: err,
    });
  }
}

/* =========================================================
   EXTRACT CONTEXT
========================================================= */

/**
 * Pull the client IP from a request. Same logic as the
 * login route — kept here so every logger uses the same
 * source of truth.
 */
export function getAuditIp(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();

  return null;
}

/**
 * Extract a truncated user agent string.
 *
 * Truncate to 500 chars to prevent a malicious client from
 * filling the audit log with junk. Real user agents are
 * under 200 chars; anything longer is almost certainly an
 * attack.
 */
export function getAuditUserAgent(request: Request): string | null {
  const ua = request.headers.get("user-agent");
  if (!ua) return null;

  return ua.slice(0, 500);
}