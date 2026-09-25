import { NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { getProjectAccess } from "@/app/lib/project-access";

import { db } from "@/app/db";
import {
  audits,
  auditIssues,
  auditPages,
  projects,
} from "@/app/db/schema";
import { getCurrentUser } from "@/app/lib/auth";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    // const [result] = await db
    //   .select({
    //     audit: audits,
    //     project: projects,
    //   })
    //   .from(audits)
    //   .innerJoin(projects, eq(audits.projectId, projects.id))
    //   .where(
    //     and(
    //       eq(audits.id, id),
    //       eq(projects.userId, user.id)
    //     )
    //   )
    //   .limit(1);

          /* ---------- Load audit + project (no ownership filter) ---------- */

    const [result] = await db
      .select({
        audit: audits,
        project: projects,
      })
      .from(audits)
      .innerJoin(projects, eq(audits.projectId, projects.id))
      .where(eq(audits.id, id))
      .limit(1);

    if (!result) {
      return NextResponse.json(
        { error: "Audit not found." },
        { status: 404 }
      );
    }

    /* ---------- Access check: owner OR accepted collaborator ---------- */

    const access = await getProjectAccess(user.id, result.project.id);

    if (!access) {
      return NextResponse.json(
        { error: "Audit not found." },
        { status: 404 }
      );
    }

    if (!result) {
      return NextResponse.json(
        { error: "Audit not found." },
        { status: 404 }
      );
    }

    const pages = await db
      .select()
      .from(auditPages)
      .where(eq(auditPages.auditId, id))
      .orderBy(asc(auditPages.createdAt));

    const issues = await db
      .select()
      .from(auditIssues)
      .where(eq(auditIssues.auditId, id))
      .orderBy(asc(auditIssues.createdAt));

    /*
     * Calculate issue summary
     */
    const issueSummary = {
      critical: issues.filter(
        (issue) => issue.severity === "critical"
      ).length,

      errors: issues.filter(
        (issue) => issue.severity === "error"
      ).length,

      warnings: issues.filter(
        (issue) => issue.severity === "warning"
      ).length,

      notices: issues.filter(
        (issue) => issue.severity === "notice"
      ).length,
    };

    /*
     * Priority issue summary
     */
    const prioritySummary = {
      high: issues.filter(
        (issue) =>
          issue.severity === "critical" ||
          issue.severity === "error"
      ).length,

      medium: issues.filter(
        (issue) => issue.severity === "warning"
      ).length,

      low: issues.filter(
        (issue) => issue.severity === "notice"
      ).length,
    };

    /*
     * Page summary
     */
    const pageSummary = {
      total: pages.length,

      passed: pages.filter(
        (page) => (page.pageScore ?? 0) >= 90
      ).length,

      good: pages.filter(
        (page) =>
          (page.pageScore ?? 0) >= 70 &&
          (page.pageScore ?? 0) < 90
      ).length,

      warnings: pages.filter(
        (page) =>
          (page.pageScore ?? 0) >= 50 &&
          (page.pageScore ?? 0) < 70
      ).length,

      poor: pages.filter(
        (page) => (page.pageScore ?? 0) < 50
      ).length,
    };

    /*
     * Top issues
     */
    const topIssues = [...issues]
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = {
          critical: 4,
          error: 3,
          warning: 2,
          notice: 1,
        };

        return (
          (priorityOrder[b.severity] ?? 0) -
          (priorityOrder[a.severity] ?? 0)
        );
      })
      .slice(0, 10);

    /*
     * Category breakdown from issues.
     *
     * If category scores were saved by Phase 5,
     * use them directly.
     */
    const categoryScores =
      result.audit.categoryScores &&
      typeof result.audit.categoryScores === "object"
        ? result.audit.categoryScores
        : {};

    /*
     * Previous audit
     */
  const projectAudits = await db
  .select()
  .from(audits)
  .where(eq(audits.projectId, result.project.id))
  .orderBy(desc(audits.createdAt))
  .limit(2);

const previousAudit = projectAudits.find(
  (audit) => audit.id !== result.audit.id
);

let previous = null;

if (previousAudit) {
  previous = {
    id: previousAudit.id,
    score: previousAudit.score,
    pagesCrawled: previousAudit.pagesCrawled,
    pagesWithErrors: previousAudit.pagesWithErrors,
    pagesWithWarnings: previousAudit.pagesWithWarnings,
    pagesPassed: previousAudit.pagesPassed,
    createdAt: previousAudit.createdAt,
  };
}

const scoreChange =
  previous?.score !== null &&
  previous?.score !== undefined &&
  result.audit.score !== null &&
  result.audit.score !== undefined
    ? result.audit.score - previous.score
    : null;

    return NextResponse.json({
      success: true,

      project: {
        id: result.project.id,
        name: result.project.name,
        domain: result.project.domain,
      },

      audit: result.audit,

      summary: {
        score: result.audit.score ?? 0,
        pages: pageSummary,
        issues: issueSummary,
        priorities: prioritySummary,
        scoreChange,
      },

      categoryScores,

      priorityIssues: topIssues,

      pages,

      issues,

      comparison: {
        previous,
        scoreChange,
      },
    });
  } catch (error) {
    console.error("Audit report error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate audit report.",
      },
      { status: 500 }
    );
  }
}