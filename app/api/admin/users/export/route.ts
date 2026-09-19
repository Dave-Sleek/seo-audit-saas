import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/app/db";
import { users, subscriptions, plans } from "@/app/db/schema";
import { getCurrentUser } from "@/app/lib/auth";

/* =========================================================
   AUTH GUARD
========================================================= */

async function checkAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  if (user.role !== "admin") {
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  return null;
}

/* =========================================================
   HELPERS
========================================================= */

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString();
}

function formatHuman(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* =========================================================
   GET /api/admin/users/export?format=csv|pdf
========================================================= */

export async function GET(request: Request) {
  try {
    const authError = await checkAdmin();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") || "csv").toLowerCase();

    /* ---------- Load users ---------- */

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        emailVerifiedAt: users.emailVerifiedAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    /* ---------- Subscription info per user ---------- */

    const subs = await db
      .select({
        userId: subscriptions.userId,
        planName: plans.name,
        status: subscriptions.status,
        endsAt: subscriptions.endsAt,
      })
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.planId, plans.id));

    const subMap = new Map<
      string,
      { planName: string | null; status: string; endsAt: Date }
    >();

    for (const s of subs) {
      if (!subMap.has(s.userId)) {
        subMap.set(s.userId, {
          planName: s.planName ?? null,
          status: s.status,
          endsAt: s.endsAt,
        });
      }
    }

    /* ---------- Enrich ---------- */

    const enriched = rows.map((u) => {
      const sub = subMap.get(u.id);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        verified: u.emailVerifiedAt ? "Yes" : "No",
        plan: sub?.planName ?? "—",
        subscriptionStatus: sub?.status ?? "—",
        subscriptionEnds: sub?.endsAt ?? null,
        joined: u.createdAt,
      };
    });

    const filenameBase = `users-${new Date()
      .toISOString()
      .slice(0, 10)}`;

    /* ---------- CSV ---------- */

    if (format === "csv") {
      const headers = [
        "ID",
        "Name",
        "Email",
        "Role",
        "Verified",
        "Plan",
        "Subscription Status",
        "Subscription Ends",
        "Joined",
      ];

      const lines: string[] = [headers.join(",")];

      for (const u of enriched) {
        lines.push(
          [
            csvEscape(u.id),
            csvEscape(u.name),
            csvEscape(u.email),
            csvEscape(u.role),
            csvEscape(u.verified),
            csvEscape(u.plan),
            csvEscape(u.subscriptionStatus),
            csvEscape(formatDate(u.subscriptionEnds)),
            csvEscape(formatDate(u.joined)),
          ].join(",")
        );
      }

      const csv = "\uFEFF" + lines.join("\r\n"); // BOM for Excel

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    /* ---------- PDF (print-ready HTML) ---------- */

    if (format === "pdf") {
      const now = formatHuman(new Date());

      const rowsHtml = enriched
        .map(
          (u) => `
            <tr>
              <td>${escapeHtml(u.name)}</td>
              <td>${escapeHtml(u.email)}</td>
              <td>${escapeHtml(u.role)}</td>
              <td>${escapeHtml(u.verified)}</td>
              <td>${escapeHtml(u.plan)}</td>
              <td>${escapeHtml(u.subscriptionStatus)}</td>
              <td>${escapeHtml(formatHuman(u.joined))}</td>
            </tr>
          `
        )
        .join("");

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Users Export — ${now}</title>
  <style>
    @page { size: A4 landscape; margin: 16mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 24px;
      font-size: 12px;
    }
    header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 2px solid #f97316;
    }
    h1 {
      font-size: 20px;
      margin: 0;
      letter-spacing: -0.02em;
    }
    .meta {
      color: #64748b;
      font-size: 11px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th, td {
      padding: 8px 10px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    th {
      background: #f8fafc;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      font-size: 9px;
      letter-spacing: 0.04em;
    }
    tr:nth-child(even) td { background: #fafbfc; }
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      color: #94a3b8;
      font-size: 10px;
      text-align: center;
    }
    .no-print { display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 16px; }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #f97316;
      color: #fff;
      padding: 8px 14px;
      border-radius: 8px;
      border: 0;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
    }
    .btn.secondary {
      background: #fff;
      color: #334155;
      border: 1px solid #cbd5e1;
    }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <a class="btn secondary" href="/dashboard/admin/users">← Back</a>
    <button class="btn" onclick="window.print()">Save as PDF</button>
  </div>

  <header>
    <h1>Users Export</h1>
    <div class="meta">
      ${enriched.length} user${enriched.length === 1 ? "" : "s"} · Generated ${now}
    </div>
  </header>

  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Email</th>
        <th>Role</th>
        <th>Verified</th>
        <th>Plan</th>
        <th>Subscription</th>
        <th>Joined</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:24px;">No users found.</td></tr>`}
    </tbody>
  </table>

  <div class="footer">
    Confidential — for internal use only.
  </div>

  <script>
    // Auto-open print dialog after a short delay
    window.addEventListener("load", function () {
      setTimeout(function () {
        // Uncomment the line below if you want the print dialog to open automatically
        // window.print();
      }, 300);
    });
  </script>
</body>
</html>`;

      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json(
      { error: "Unsupported format. Use csv or pdf." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Admin users export error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to export users.",
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   SMALL UTIL
========================================================= */

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}