// app/lib/audit-log-filters.ts

import {
  and,
  eq,
  gte,
  ilike,
  lte,
  or,
  type SQL,
} from "drizzle-orm";

import { auditLog, users } from "@/app/db/schema";

export type AuditLogFilters = {
  q?: string;
  eventType?: string;
  severity?: string;
  from?: string;
  to?: string;
};

/**
 * Build a Drizzle `where` clause from raw search params.
 *
 * Shared between the audit-log page and the CSV export route
 * so both honor the exact same filters.
 */
export function buildAuditLogWhere(
  params: AuditLogFilters
): SQL | undefined {
  const conditions: SQL[] = [];

  if (params.q) {
    const q = `%${params.q.trim()}%`;
    const clause = or(
      ilike(users.email, q),
      ilike(users.name, q),
      ilike(auditLog.ipAddress, q)
    );
    if (clause) conditions.push(clause);
  }

  if (params.eventType) {
    conditions.push(eq(auditLog.eventType, params.eventType));
  }

  if (params.severity) {
    conditions.push(eq(auditLog.severity, params.severity));
  }

  if (params.from) {
    const fromDate = new Date(params.from);
    if (!Number.isNaN(fromDate.getTime())) {
      conditions.push(gte(auditLog.createdAt, fromDate));
    }
  }

  if (params.to) {
    const toDate = new Date(params.to);
    if (!Number.isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(auditLog.createdAt, toDate));
    }
  }

  return conditions.length ? and(...conditions) : undefined;
}