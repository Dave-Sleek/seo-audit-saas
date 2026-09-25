// app/api/admin/audit-log/export/route.ts

import { desc, eq } from "drizzle-orm";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import { auditLog, users } from "@/app/db/schema";
import { buildAuditLogWhere } from "@/app/lib/audit-log-filters";

export const dynamic = "force-dynamic";

/**
 * Hard cap on rows per export. Prevents a rogue query from
 * generating a 500MB CSV and OOMing the server. Raise if you
 * ever actually need more than this in one file.
 */
const MAX_ROWS = 50_000;

/* =========================================================
   CSV HELPERS
========================================================= */

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";

  const str = typeof value === "string" ? value : String(value);

  // Always quote. Handles commas, quotes, newlines safely.
  return `"${str.replace(/"/g, '""')}"`;
}

function row(fields: unknown[]): string {
  return fields.map(csvEscape).join(",");
}

/* =========================================================
   ROUTE
========================================================= */

export async function GET(request: Request) {
  /* ---------- Admin guard ---------- */

  const user = await getCurrentUser();

  if (!user) {
    return new Response("Unauthorized.", { status: 401 });
  }

  if (user.role !== "admin") {
    return new Response("Forbidden.", { status: 403 });
  }

  /* ---------- Parse filters from query string ---------- */

  const url = new URL(request.url);
  const filters = {
    q: url.searchParams.get("q") ?? undefined,
    eventType: url.searchParams.get("eventType") ?? undefined,
    severity: url.searchParams.get("severity") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  };

  const where = buildAuditLogWhere(filters);

  /* ---------- Fetch rows ---------- */

  const rows = await db
    .select({
      id: auditLog.id,
      createdAt: auditLog.createdAt,
      eventType: auditLog.eventType,
      severity: auditLog.severity,
      ipAddress: auditLog.ipAddress,
      userAgent: auditLog.userAgent,
      metadata: auditLog.metadata,
      userId: auditLog.userId,
      actorId: auditLog.actorId,
      userEmail: users.email,
      userName: users.name,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.userId, users.id))
    .where(where)
    .orderBy(desc(auditLog.createdAt))
    .limit(MAX_ROWS);

  /* ---------- Build CSV ---------- */

  const header = row([
    "Timestamp",
    "Event type",
    "Severity",
    "User email",
    "User name",
    "User id",
    "Actor id",
    "IP address",
    "User agent",
    "Metadata (JSON)",
  ]);

  const lines: string[] = [header];

  for (const r of rows) {
    lines.push(
      row([
        r.createdAt.toISOString(),
        r.eventType,
        r.severity,
        r.userEmail ?? "",
        r.userName ?? "",
        r.userId ?? "",
        r.actorId ?? "",
        r.ipAddress ?? "",
        r.userAgent ?? "",
        JSON.stringify(r.metadata ?? {}),
      ])
    );
  }

  const csv = lines.join("\r\n");

  /* ---------- Filename ---------- */

  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19); // YYYY-MM-DD_HH-MM-SS

  const filename = `audit-log_${stamp}.csv`;

  /* ---------- Stream response ---------- */

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Prevents a proxy from caching a potentially sensitive file.
      "Cache-Control": "no-store, max-age=0",
    },
  });
}