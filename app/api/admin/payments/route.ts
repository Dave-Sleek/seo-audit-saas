import { NextResponse } from "next/server";
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import {
  payments,
  plans,
  subscriptions,
  users,
} from "@/app/db/schema";

/* =========================================================
   AUTH
========================================================= */

/**
 * Admin guard. Do NOT trust a client-supplied flag.
 *
 * The `role` column on `users` is the source of truth.
 * Adjust the accepted role value if you use something
 * other than "admin".
 */
async function requireAdmin() {
  const user = await getCurrentUser();

  if (!user) return null;
  if (user.role !== "admin") return null;

  return user;
}

/* =========================================================
   GET /api/admin/payments
========================================================= */

export async function GET(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json(
      { error: "Forbidden." },
      { status: 403 }
    );
  }

  const url = new URL(request.url);

  const status = url.searchParams.get("status");
  const planId = url.searchParams.get("planId");
  const search = url.searchParams.get("q");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || 25, 1),
    100
  );

  const offset = Math.max(
    Number(url.searchParams.get("offset")) || 0,
    0
  );

  /* ---------- WHERE conditions ---------- */

  const conditions = [];

  if (status) {
    conditions.push(eq(payments.status, status));
  }

  if (from) {
    const fromDate = new Date(from);
    if (!Number.isNaN(fromDate.getTime())) {
      conditions.push(gte(payments.createdAt, fromDate));
    }
  }

  if (to) {
    const toDate = new Date(to);
    if (!Number.isNaN(toDate.getTime())) {
      // Include the entire `to` day.
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(payments.createdAt, toDate));
    }
  }

  if (planId) {
    // metadata is jsonb; ->> returns text.
    conditions.push(
      sql`${payments.metadata}->>'planId' = ${planId}`
    );
  }

  if (search) {
    const q = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(users.email, q),
        ilike(payments.reference, q)
      )
    );
  }

  const where = conditions.length
    ? and(...conditions)
    : undefined;

  /* ---------- Rows ---------- */

  const rows = await db
    .select({
      id: payments.id,
      reference: payments.reference,
      status: payments.status,
      amount: payments.amount,
      currency: payments.currency,
      createdAt: payments.createdAt,
      paidAt: payments.paidAt,
      subscriptionId: payments.subscriptionId,
      userEmail: users.email,
      userId: users.id,
      planId: sql<string | null>`${payments.metadata}->>'planId'`,
      planName: plans.name,
      planInterval: plans.interval,
    })
    .from(payments)
    .innerJoin(users, eq(payments.userId, users.id))
    .leftJoin(
      plans,
      /*
       * plans.id is uuid, metadata->>'planId' is text.
       * Postgres will not compare them without an explicit
       * cast. This was the "Failed query" cause.
       */
      sql`${plans.id} = (${payments.metadata}->>'planId')::uuid`
    )
    .where(where)
    .orderBy(desc(payments.createdAt))
    .limit(limit)
    .offset(offset);

  /* ---------- Stats (last 30 days) ---------- */

  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  );

  const [stats] = await db
    .select({
      // amount is numeric(12,2); SUM returns numeric; cast to float for JS.
      totalRevenue: sql<number>`COALESCE(SUM(${payments.amount}) FILTER (WHERE ${payments.status} = 'successful'), 0)::float`,
      successfulCount: sql<number>`COUNT(*) FILTER (WHERE ${payments.status} = 'successful')::int`,
      failedCount: sql<number>`COUNT(*) FILTER (WHERE ${payments.status} = 'failed')::int`,
      pendingCount: sql<number>`COUNT(*) FILTER (WHERE ${payments.status} = 'pending')::int`,
      totalCount: sql<number>`COUNT(*)::int`,
    })
    .from(payments)
    .where(gte(payments.createdAt, thirtyDaysAgo));

  const [subStats] = await db
    .select({
      activeSubscriptions: sql<number>`COUNT(*) FILTER (WHERE ${subscriptions.status} IN ('active', 'non_renewing') AND ${subscriptions.endsAt} > now())::int`,
      newSubscriptions: sql<number>`COUNT(*) FILTER (WHERE ${subscriptions.createdAt} >= ${thirtyDaysAgo})::int`,
    })
    .from(subscriptions);

  /* ---------- Response ---------- */

  return NextResponse.json({
    rows: rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      status: r.status,
      amount: Number(r.amount),
      currency: r.currency,
      createdAt: r.createdAt,
      paidAt: r.paidAt,
      subscriptionId: r.subscriptionId,
      userEmail: r.userEmail,
      userId: r.userId,
      planId: r.planId,
      planName: r.planName,
      planInterval: r.planInterval,
    })),
    stats: {
      totalRevenue: Number(stats?.totalRevenue ?? 0),
      successfulCount: Number(stats?.successfulCount ?? 0),
      failedCount: Number(stats?.failedCount ?? 0),
      pendingCount: Number(stats?.pendingCount ?? 0),
      totalCount: Number(stats?.totalCount ?? 0),
      activeSubscriptions: Number(subStats?.activeSubscriptions ?? 0),
      newSubscriptions: Number(subStats?.newSubscriptions ?? 0),
    },
    pagination: {
      limit,
      offset,
      hasMore: rows.length === limit,
    },
  });
}