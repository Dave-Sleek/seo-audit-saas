import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/app/db";
import { notifications } from "@/app/db/schema";

// app/lib/notifications.ts

export type NotificationType =
  | "audit.completed"
  | "audit.failed"
  | "ai_recommendations.ready"
  | "payment.succeeded"
  | "payment.failed"
  | "subscription.renewed"
  | "subscription.renewal_disabled"
  | "subscription.cancelled"
  | "subscription.expiring"
  | "subscription.expired"
  | "security.2fa_enabled"
  | "security.2fa_disabled"
  | "security.password_changed";

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
  actionUrl?: string;
};

/**
 * Create a single notification.
 *
 * Never throws — failures are logged. A broken notification
 * must not break the calling action (e.g. don't fail a
 * payment webhook because the notification insert failed).
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<void> {
  try {
    await db.insert(notifications).values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      metadata: input.metadata ?? {},
      actionUrl: input.actionUrl ?? null,
    });
  } catch (err) {
    console.error("[notifications] create failed", {
      userId: input.userId,
      type: input.type,
      error: err,
    });
  }
}

/**
 * Create many notifications at once. Same non-throwing
 * semantics as createNotification.
 */
export async function createNotifications(
  inputs: CreateNotificationInput[]
): Promise<void> {
  if (inputs.length === 0) return;

  try {
    await db.insert(notifications).values(
      inputs.map((input) => ({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        metadata: input.metadata ?? {},
        actionUrl: input.actionUrl ?? null,
      }))
    );
  } catch (err) {
    console.error("[notifications] bulk create failed", {
      count: inputs.length,
      error: err,
    });
  }
}

/**
 * Fetch the most recent N notifications for a user.
 */
export async function listNotifications(
  userId: string,
  limit = 20
) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

/**
 * Count unread notifications. Fast because of the partial index.
 */
export async function countUnread(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt)
      )
    );

  return row?.count ?? 0;
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(
  userId: string,
  notificationId: string
): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt)
      )
    );
}

/**
 * Mark every unread notification as read for a user.
 */
export async function markAllAsRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt)
      )
    );
}

/**
 * Delete notifications older than the given age.
 * Intended for a daily cron job.
 */
export async function pruneOldNotifications(
  olderThanDays = 90
): Promise<number> {
  const cutoff = new Date(
    Date.now() - olderThanDays * 24 * 60 * 60 * 1000
  );

  const deleted = await db
    .delete(notifications)
    .where(lt(notifications.createdAt, cutoff))
    .returning({ id: notifications.id });

  return deleted.length;
}