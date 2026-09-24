import {
  NextRequest,
  NextResponse,
} from "next/server";

import { and, eq } from "drizzle-orm";

import { db } from "@/app/db";

import {
  projects,
  audits,
  auditPages,
  auditIssues,
} from "@/app/db/schema";

import { getCurrentUser } from "@/app/lib/auth";

import { createNotification } from "@/app/lib/notifications";

import { crawlWebsite } from "@/app/lib/seo/crawler";

import {
  analyzePage,
  type SEOIssueCategory,
  type PriorityIssue,
  type SEOCategoryScores,
} from "@/app/lib/seo/analyzer";

import { canRunAudit } from "@/app/lib/feature-gate";

import {
  recordPagesCrawled,
  reserveAuditAndProject,
  refundAuditReservation,
} from "@/app/lib/usage";

/* =========================================================
   CONSTANTS
========================================================= */

const MIN_PAGES_PER_AUDIT = 1;
const MAX_SAFE_PAGES_PER_AUDIT = 10_000;

/* =========================================================
   CATEGORY SCORE AGGREGATION
========================================================= */

function createEmptyAggregate(): SEOCategoryScores {
  return {
    technical: { score: 100, issues: 0, critical: 0, errors: 0, warnings: 0, notices: 0 },
    "on-page": { score: 100, issues: 0, critical: 0, errors: 0, warnings: 0, notices: 0 },
    crawlability: { score: 100, issues: 0, critical: 0, errors: 0, warnings: 0, notices: 0 },
    content: { score: 100, issues: 0, critical: 0, errors: 0, warnings: 0, notices: 0 },
    links: { score: 100, issues: 0, critical: 0, errors: 0, warnings: 0, notices: 0 },
    accessibility: { score: 100, issues: 0, critical: 0, errors: 0, warnings: 0, notices: 0 },
    social: { score: 100, issues: 0, critical: 0, errors: 0, warnings: 0, notices: 0 },
    "structured-data": { score: 100, issues: 0, critical: 0, errors: 0, warnings: 0, notices: 0 },
  };
}

function aggregateCategoryScores(
  target: SEOCategoryScores,
  source: SEOCategoryScores
) {
  const categories: SEOIssueCategory[] = [
    "technical",
    "on-page",
    "crawlability",
    "content",
    "links",
    "accessibility",
    "social",
    "structured-data",
  ];

  for (const category of categories) {
    target[category].issues += source[category].issues;
    target[category].critical += source[category].critical;
    target[category].errors += source[category].errors;
    target[category].warnings += source[category].warnings;
    target[category].notices += source[category].notices;
  }
}

function finalizeCategoryScores(
  aggregate: SEOCategoryScores,
  pageCount: number
): SEOCategoryScores {
  if (pageCount <= 0) return aggregate;

  const categories: SEOIssueCategory[] = [
    "technical",
    "on-page",
    "crawlability",
    "content",
    "links",
    "accessibility",
    "social",
    "structured-data",
  ];

  for (const category of categories) {
    const issueCount = aggregate[category].issues;

    if (issueCount === 0) {
      aggregate[category].score = 100;
      continue;
    }

    let deduction = 0;
    deduction += aggregate[category].critical * 25;
    deduction += aggregate[category].errors * 15;
    deduction += aggregate[category].warnings * 7;
    deduction += aggregate[category].notices * 2;

    aggregate[category].score = Math.max(
      0,
      Math.min(100, Math.round(100 - deduction / pageCount))
    );
  }

  return aggregate;
}

/* =========================================================
   URL HELPERS
========================================================= */

function normalizeDomain(input: string): string {
  try {
    const value = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeWebsiteUrl(input: string): string {
  const value = input.trim();
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(withProtocol);
  url.hash = "";
  return url.toString();
}

/* =========================================================
   PLAN PAGE LIMIT
========================================================= */

function getSafePageLimit(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Invalid page limit configured for this plan.");
  }

  if (!Number.isInteger(value)) {
    throw new Error("Invalid page limit configured for this plan.");
  }

  if (value < MIN_PAGES_PER_AUDIT) {
    throw new Error("Invalid page limit configured for this plan.");
  }

  if (value > MAX_SAFE_PAGES_PER_AUDIT) {
    throw new Error(
      `The configured page limit exceeds the maximum supported limit of ${MAX_SAFE_PAGES_PER_AUDIT} pages.`
    );
  }

  return value;
}

/* =========================================================
   SSRF / PRIVATE NETWORK PROTECTION
========================================================= */

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);

  if (
    parts.length !== 4 ||
    parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)
  ) {
    return false;
  }

  const [a, b] = parts;

  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");

  return (
    normalized === "localhost" ||
    normalized === "localhost.localdomain" ||
    normalized === "::1" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized.endsWith(".local") ||
    isPrivateIpv4(normalized)
  );
}

/* =========================================================
   FEATURE ACCESS RESPONSE
========================================================= */

function featureAccessResponse(access: {
  code: string | null;
  message: string | null;
  used: number;
  limit: number;
  remaining: number;
}) {
  return NextResponse.json(
    {
      success: false,
      code: access.code,
      error: access.message,
      usage: {
        used: access.used,
        limit: access.limit,
        remaining: access.remaining,
      },
      upgradeRequired:
        access.code === "NO_SUBSCRIPTION" ||
        access.code === "AUDIT_LIMIT_REACHED" ||
        access.code === "PROJECT_LIMIT_REACHED",
    },
    { status: 403 }
  );
}

/* =========================================================
   RESPONSE PAGE SHAPE
========================================================= */

/**
 * Shape of each page in the API response's `pages` array.
 *
 * The `id` is the audit_pages UUID, needed by the client so
 * React has a stable key for rendering rows. Without it, the
 * dashboard component falls back to `page.url`, which works
 * but is fragile (URLs can collide after canonicalization).
 */
type ResponsePage = {
  id: string;
  url: string;
  finalUrl: string | null;
  statusCode: number | null;
  contentType: string | null;
  redirectCount: number;
  redirectChain: unknown;
  responseTimeMs: number;
};

/* =========================================================
   POST
========================================================= */

export async function POST(request: NextRequest) {
  let auditId: string | null = null;

  // Hoisted so the catch block can refund if the reservation succeeded.
  let reservation: Awaited<
    ReturnType<typeof reserveAuditAndProject>
  > | null = null;

  // Kept for the failure-path refund call — user is stable across the request.
  let currentUserId: string | null = null;

  // Captured so the catch block can notify the correct user.
  let currentDomain: string | null = null;
  let currentProjectId: string | null = null;

  try {
    /* -----------------------------------------------------
       AUTHENTICATION
    ----------------------------------------------------- */

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          code: "UNAUTHORIZED",
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    currentUserId = user.id;

    /* -----------------------------------------------------
       AUDIT FEATURE PRE-CHECK (cheap early exit)
    ----------------------------------------------------- */

    const auditAccess = await canRunAudit(user.id);

    if (!auditAccess.allowed) {
      return featureAccessResponse(auditAccess);
    }

    /* -----------------------------------------------------
       REQUEST BODY
    ----------------------------------------------------- */

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_REQUEST_BODY",
          error: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const rawUrl =
      typeof body === "object" &&
      body !== null &&
      "url" in body &&
      typeof (body as { url?: unknown }).url === "string"
        ? (body as { url: string }).url.trim()
        : "";

    if (!rawUrl) {
      return NextResponse.json(
        {
          success: false,
          code: "URL_REQUIRED",
          error: "Website URL is required.",
        },
        { status: 400 }
      );
    }

    /* -----------------------------------------------------
       NORMALIZE URL
    ----------------------------------------------------- */

    let normalizedWebsiteUrl: string;

    try {
      normalizedWebsiteUrl = normalizeWebsiteUrl(rawUrl);
    } catch {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_URL",
          error: "Please provide a valid website URL.",
        },
        { status: 400 }
      );
    }

    const parsedUrl = new URL(normalizedWebsiteUrl);

    /* -----------------------------------------------------
       PROTOCOL VALIDATION
    ----------------------------------------------------- */

    if (
      parsedUrl.protocol !== "http:" &&
      parsedUrl.protocol !== "https:"
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "UNSUPPORTED_PROTOCOL",
          error: "Only HTTP and HTTPS URLs are supported.",
        },
        { status: 400 }
      );
    }

    /* -----------------------------------------------------
       SSRF PROTECTION
    ----------------------------------------------------- */

    if (isBlockedHostname(parsedUrl.hostname)) {
      return NextResponse.json(
        {
          success: false,
          code: "BLOCKED_HOSTNAME",
          error: "This website address is not allowed.",
        },
        { status: 400 }
      );
    }

    /* -----------------------------------------------------
       DOMAIN
    ----------------------------------------------------- */

    const domain = normalizeDomain(normalizedWebsiteUrl);

    if (!domain) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_DOMAIN",
          error: "Unable to determine the website domain.",
        },
        { status: 400 }
      );
    }

    currentDomain = domain;

    /* -----------------------------------------------------
       ATOMIC AUDIT + PROJECT RESERVATION
    ----------------------------------------------------- */

    reservation = await reserveAuditAndProject(user.id, {
      name: domain,
      domain,
      description: `SEO project for ${domain}`,
      isActive: true,
    });

    /* -----------------------------------------------------
       RESERVATION FAILED
    ----------------------------------------------------- */

    if (!reservation.allowed) {
      return featureAccessResponse({
        code: reservation.code,
        message: reservation.message,
        used:
          reservation.code === "PROJECT_LIMIT_REACHED"
            ? reservation.projectUsage.used
            : reservation.auditUsage.used,
        limit:
          reservation.code === "PROJECT_LIMIT_REACHED"
            ? reservation.projectUsage.limit
            : reservation.auditUsage.limit,
        remaining:
          reservation.code === "PROJECT_LIMIT_REACHED"
            ? reservation.projectUsage.remaining
            : reservation.auditUsage.remaining,
      });
    }

    /* -----------------------------------------------------
       PROJECT
    ----------------------------------------------------- */

    const project = reservation.project;

    if (!project) {
      throw new Error("Audit reservation completed without a project.");
    }

    currentProjectId = project.id;

    /* -----------------------------------------------------
       AUTHORITATIVE PLAN
    ----------------------------------------------------- */

    const reservedPlan = reservation.plan;

    if (!reservedPlan) {
      throw new Error("Audit reservation completed without a plan.");
    }

    /* -----------------------------------------------------
       PLAN PAGE LIMIT — validated BEFORE creating the audit
    ----------------------------------------------------- */

    let maxPages: number;

    try {
      maxPages = getSafePageLimit(reservedPlan.pagesPerAudit);
    } catch {
      await refundAuditReservation(user.id, {
        projectCreated: reservation.projectCreated,
        projectId: reservation.project?.id,
      });

      reservation = null;

      return NextResponse.json(
        {
          success: false,
          code: "INVALID_PLAN_CONFIGURATION",
          error:
            "The page limit configured for your plan is invalid. Please contact support.",
        },
        { status: 500 }
      );
    }

    /* -----------------------------------------------------
       CREATE AUDIT
    ----------------------------------------------------- */

    const createdAudits = await db
      .insert(audits)
      .values({
        projectId: project.id,
        url: normalizedWebsiteUrl,
        status: "running",
        startedAt: new Date(),
      })
      .returning();

    const audit = createdAudits[0];

    if (!audit) {
      throw new Error("Unable to create audit.");
    }

    auditId = audit.id;

    /* -----------------------------------------------------
       CRAWL WEBSITE
    ----------------------------------------------------- */

    const crawlResult = await crawlWebsite(normalizedWebsiteUrl, maxPages);
    const crawledPages = crawlResult.pages;

    /* -----------------------------------------------------
       EMPTY CRAWL PROTECTION
    ----------------------------------------------------- */

    if (crawledPages.length === 0) {
      throw new Error(
        "No crawlable pages were found on this website. The website may be unavailable, blocked by robots.txt, or preventing the crawler from accessing its pages."
      );
    }

    /* -----------------------------------------------------
       HARD PAGE LIMIT SAFETY CHECK
    ----------------------------------------------------- */

    if (crawledPages.length > maxPages) {
      throw new Error(
        "The crawler exceeded the page limit configured for this plan."
      );
    }

    /* -----------------------------------------------------
       AGGREGATES
    ----------------------------------------------------- */

    let totalScore = 0;
    let pagesWithErrors = 0;
    let pagesWithWarnings = 0;
    let pagesPassed = 0;

    const categoryScores = createEmptyAggregate();
    const priorityIssues: PriorityIssue[] = [];

    /*
     * Enriched page data for the response. Captures the DB
     * `id` returned from the insert, which the client needs
     * as a React key. Populated inside the analysis loop.
     */
    const responsePages: ResponsePage[] = [];

    /* -----------------------------------------------------
       ANALYZE PAGES
    ----------------------------------------------------- */

    for (const crawledPage of crawledPages) {
      const analysis = analyzePage(crawledPage.html, crawledPage.finalUrl, {
        statusCode: crawledPage.statusCode,
        finalUrl: crawledPage.finalUrl,
        redirectCount: crawledPage.redirectCount,
        redirectChain: crawledPage.redirectChain,
        responseTimeMs: crawledPage.responseTimeMs,
      });

      totalScore += analysis.score;

      aggregateCategoryScores(categoryScores, analysis.categoryScores);
      priorityIssues.push(...analysis.priorityIssues);

      const hasErrors = analysis.issues.some(
        (issue) => issue.severity === "critical" || issue.severity === "error"
      );

      const hasWarnings = analysis.issues.some(
        (issue) => issue.severity === "warning"
      );

      if (hasErrors) pagesWithErrors++;
      else if (hasWarnings) pagesWithWarnings++;
      else pagesPassed++;

      /* ---------------------------------------------------
         SAVE PAGE
      --------------------------------------------------- */

      const insertedPages = await db
        .insert(auditPages)
        .values({
          auditId: audit.id,
          url: crawledPage.url,
          finalUrl: crawledPage.finalUrl,
          statusCode: crawledPage.statusCode,
          contentType: crawledPage.contentType,
          redirectCount: crawledPage.redirectCount,
          redirectChain: crawledPage.redirectChain,
          title: analysis.title,
          titleLength: analysis.titleLength,
          metaDescription: analysis.metaDescription,
          metaDescriptionLength: analysis.metaDescriptionLength,
          canonicalUrl: analysis.canonicalUrl,
          robotsMeta: analysis.robotsMeta,
          h1: analysis.h1,
          h1Count: analysis.h1Count,
          h2Count: analysis.h2Count,
          wordCount: analysis.wordCount,
          internalLinksCount: analysis.internalLinksCount,
          externalLinksCount: analysis.externalLinksCount,
          imagesCount: analysis.imagesCount,
          imagesWithoutAlt: analysis.imagesWithoutAlt,
          hasHttps: analysis.hasHttps,
          hasSchema: analysis.hasSchema,
          hasOpenGraph: analysis.hasOpenGraph,
          hasTwitterCard: analysis.hasTwitterCard,
          isIndexable: analysis.isIndexable,
          pageScore: analysis.score,
          responseTimeMs: crawledPage.responseTimeMs,
        })
        .returning();

      const auditPage = insertedPages[0];

      if (!auditPage) {
        throw new Error(`Unable to save audit page: ${crawledPage.url}`);
      }

      /*
       * Capture the inserted row's id for the response.
       * Do this immediately after the insert so the enriched
       * page always lines up with the DB row.
       */
      responsePages.push({
        id: auditPage.id,
        url: crawledPage.url,
        finalUrl: crawledPage.finalUrl,
        statusCode: crawledPage.statusCode,
        contentType: crawledPage.contentType,
        redirectCount: crawledPage.redirectCount,
        redirectChain: crawledPage.redirectChain,
        responseTimeMs: crawledPage.responseTimeMs,
      });

      /* ---------------------------------------------------
         SAVE ISSUES
      --------------------------------------------------- */

      if (analysis.issues.length) {
        await db.insert(auditIssues).values(
          analysis.issues.map((issue) => ({
            auditId: audit.id,
            pageId: auditPage.id,
            category: issue.category,
            type: issue.type,
            severity: issue.severity,
            title: issue.title,
            description: issue.description,
            recommendation: issue.recommendation,
          }))
        );
      }
    }

    /* -----------------------------------------------------
       RECORD CRAWLED PAGES (reporting counter, on success)
    ----------------------------------------------------- */

    try {
      await recordPagesCrawled(user.id, crawledPages.length);
    } catch (recordError) {
      console.error("Unable to record crawled pages:", recordError);
    }

    /* -----------------------------------------------------
       FINALIZE CATEGORY SCORES
    ----------------------------------------------------- */

    finalizeCategoryScores(categoryScores, crawledPages.length);

    /* -----------------------------------------------------
       FINAL PRIORITY ISSUES
    ----------------------------------------------------- */

    const uniquePriorityIssues = Array.from(
      new Map(
        priorityIssues.map((issue) => [`${issue.type}:${issue.title}`, issue])
      ).values()
    )
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 20);

    /* -----------------------------------------------------
       OVERALL SCORE
    ----------------------------------------------------- */

    const averageScore =
      crawledPages.length > 0
        ? Math.round(totalScore / crawledPages.length)
        : 0;

    /* -----------------------------------------------------
       COMPLETE AUDIT
    ----------------------------------------------------- */

    const updatedAudits = await db
      .update(audits)
      .set({
        status: "completed",
        score: averageScore,
        pagesCrawled: crawledPages.length,
        pagesWithErrors,
        pagesWithWarnings,
        pagesPassed,
        completedAt: new Date(),
      })
      .where(eq(audits.id, audit.id))
      .returning();

    const completedAudit = updatedAudits[0];

    /* -----------------------------------------------------
       NOTIFY — AUDIT COMPLETED
    ----------------------------------------------------- */

    await createNotification({
      userId: user.id,
      type: "audit.completed",
      title: `Audit complete for ${domain}`,
      body: `Score: ${averageScore}/100 · ${pagesWithErrors} page${
        pagesWithErrors === 1 ? "" : "s"
      } with errors.`,
      actionUrl: `/dashboard/audits/${audit.id}`,
      metadata: {
        auditId: audit.id,
        projectId: project.id,
        domain,
        score: averageScore,
        pagesCrawled: crawledPages.length,
        pagesWithErrors,
      },
    });

    /* -----------------------------------------------------
       RESPONSE
    ----------------------------------------------------- */

    return NextResponse.json({
      success: true,
      audit: completedAudit ?? audit,
      project,
      plan: {
        id: reservedPlan.id,
        name: reservedPlan.name,
        slug: reservedPlan.slug,
        pagesPerAudit: reservedPlan.pagesPerAudit,
        auditLimit: reservedPlan.auditLimit,
      },
      usage: {
        auditsUsed: reservation.auditUsage.used,
        auditLimit: reservation.auditUsage.limit,
        auditsRemaining: reservation.auditUsage.remaining,
        projectsUsed: reservation.projectUsage.used,
        projectLimit: reservation.projectUsage.limit,
        projectsRemaining: reservation.projectUsage.remaining,
      },
      summary: {
        score: averageScore,
        pagesCrawled: crawledPages.length,
        pagesLimit: maxPages,
        pagesRemaining: Math.max(0, maxPages - crawledPages.length),
        pagesWithErrors,
        pagesWithWarnings,
        pagesPassed,
        categoryScores,
        priorityIssues: uniquePriorityIssues,
      },
      pages: responsePages,
    });
  } catch (error) {
    console.error("Audit error:", error);

    /* -----------------------------------------------------
       MARK AUDIT FAILED
    ----------------------------------------------------- */

    if (auditId) {
      try {
        await db
          .update(audits)
          .set({
            status: "failed",
            errorMessage:
              error instanceof Error ? error.message : "Audit failed.",
            completedAt: new Date(),
          })
          .where(eq(audits.id, auditId));
      } catch (updateError) {
        console.error("Unable to mark audit as failed:", updateError);
      }
    }

    /* -----------------------------------------------------
       REFUND RESERVATION
    ----------------------------------------------------- */

    if (reservation?.allowed && currentUserId) {
      try {
        await refundAuditReservation(currentUserId, {
          projectCreated: reservation.projectCreated,
          projectId: reservation.project?.id,
        });
      } catch (refundError) {
        console.error("Unable to refund audit reservation:", refundError);
      }
    }

    /* -----------------------------------------------------
       NOTIFY — AUDIT FAILED
    ----------------------------------------------------- */

    if (currentUserId && auditId && currentDomain) {
      const failureMessage =
        error instanceof Error ? error.message : "Audit failed.";

      await createNotification({
        userId: currentUserId,
        type: "audit.failed",
        title: `Audit failed for ${currentDomain}`,
        body: failureMessage,
        actionUrl: currentProjectId
          ? `/dashboard/projects/${currentProjectId}`
          : "/dashboard",
        metadata: {
          auditId,
          projectId: currentProjectId,
          domain: currentDomain,
        },
      });
    }

    /* -----------------------------------------------------
       USER-FACING ERROR
    ----------------------------------------------------- */

    const isKnownError = error instanceof Error;
    const message = isKnownError
      ? error.message
      : "Unable to complete SEO audit.";

    const isEmptyCrawl = message.startsWith("No crawlable pages");

    return NextResponse.json(
      {
        success: false,
        code: isEmptyCrawl ? "NO_CRAWLABLE_PAGES" : "AUDIT_FAILED",
        error: message,
      },
      { status: isEmptyCrawl ? 422 : 500 }
    );
  }
}