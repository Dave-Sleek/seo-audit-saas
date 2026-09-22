import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import {
  audits,
  auditIssues,
  auditPages,
  projects,
} from "@/app/db/schema";

import {
  generateSEORecommendations,
  AIRecommendationError,
} from "@/app/lib/ai/gemini";

import {
  checkAIRecommendationLimit,
  consumeAIRecommendation,
  refundAIRecommendation,
} from "@/app/lib/usage";

/**
 * Parse a value from the audits.ai_recommendations column.
 *
 * The column may be typed as jsonb (driver returns an object)
 * or text (driver returns a JSON string). Handle both so the
 * cached-return path works regardless of how it was written.
 */
function parseAIRecommendations(value: unknown) {
  if (value == null) return null;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  return value;
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
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

    /*
     * Verify that the audit belongs to a project owned by
     * the authenticated user.
     */
    const [result] = await db
      .select({
        audit: audits,
        project: projects,
      })
      .from(audits)
      .innerJoin(
        projects,
        eq(audits.projectId, projects.id)
      )
      .where(
        and(
          eq(audits.id, id),
          eq(projects.userId, user.id)
        )
      )
      .limit(1);

    if (!result) {
      return NextResponse.json(
        { error: "Audit not found." },
        { status: 404 }
      );
    }

    const audit = result.audit;
    const project = result.project;

    /*
     * If recommendations already exist, return them instead of
     * making another Gemini request. This does NOT consume a
     * credit — it's a pure cache read.
     */
    let regenerate = false;

    try {
      const body = await request.json();
      regenerate = body?.regenerate === true;
    } catch {
      // Empty request body is allowed.
    }

    if (audit.aiRecommendations && !regenerate) {
      const cached = parseAIRecommendations(
        audit.aiRecommendations
      );

      return NextResponse.json({
        success: true,
        cached: true,
        recommendations: cached,
        generatedAt: audit.aiGeneratedAt,
        model: audit.aiModel,
      });
    }

    /*
     * Preflight — cheap read, no side effects. Returns 402
     * with used/limit/remaining so the UI can show a helpful
     * quota message without doing expensive work.
     */
    const preflight = await checkAIRecommendationLimit(user.id);

    if (!preflight.allowed) {
      return NextResponse.json(
        {
          error:
            preflight.message ??
            "You have reached your AI recommendation limit.",
          used: preflight.used,
          limit: preflight.limit,
          remaining: preflight.remaining,
        },
        { status: 402 }
      );
    }

    const pages = await db
      .select()
      .from(auditPages)
      .where(eq(auditPages.auditId, audit.id))
      .orderBy(asc(auditPages.createdAt));

    const issues = await db
      .select()
      .from(auditIssues)
      .where(eq(auditIssues.auditId, audit.id))
      .orderBy(asc(auditIssues.createdAt));

    const pageById = new Map(
      pages.map((page) => [page.id, page])
    );

    /*
     * Reserve the credit BEFORE calling Gemini. This is the
     * authoritative increment — it closes the race where two
     * concurrent requests both pass the preflight and both
     * call Gemini.
     */
    const reservation = await consumeAIRecommendation(user.id);

    if (!reservation.allowed) {
      return NextResponse.json(
        {
          error:
            reservation.message ??
            "You have reached your AI recommendation limit.",
          used: reservation.used,
          limit: reservation.limit,
          remaining: reservation.remaining,
        },
        { status: 402 }
      );
    }

    /*
     * Everything that can fail after the reservation goes
     * inside this try/catch so we can refund the credit if
     * anything goes wrong — Gemini failure OR persistence
     * failure. The audit write is inside the try so a JSON
     * serialization error doesn't leak a charged credit.
     */
    try {
      const recommendations = await generateSEORecommendations({
        domain: project.domain,
        auditUrl: audit.url,

        score: audit.score ?? null,
        sitewideScore: audit.sitewideScore ?? null,

        pagesCrawled: audit.pagesCrawled ?? 0,
        pagesWithErrors: audit.pagesWithErrors ?? 0,
        pagesWithWarnings:
          audit.pagesWithWarnings ?? 0,
        pagesPassed: audit.pagesPassed ?? 0,

        duplicateTitleCount:
          audit.duplicateTitleCount ?? 0,

        duplicateMetaCount:
          audit.duplicateMetaCount ?? 0,

        thinContentCount:
          audit.thinContentCount ?? 0,

        orphanPageCount:
          audit.orphanPageCount ?? 0,

        brokenLinkCount:
          audit.brokenLinkCount ?? 0,

        canonicalConflictCount:
          audit.canonicalConflictCount ?? 0,

        redirectChainCount:
          audit.redirectChainCount ?? 0,

        categoryScores:
          audit.categoryScores ?? {},

        issues: issues.map((issue) => {
          const page = issue.pageId
            ? pageById.get(issue.pageId)
            : undefined;

          return {
            category: issue.category,
            type: issue.type,
            severity: issue.severity,
            title: issue.title,
            description: issue.description,
            recommendation: issue.recommendation,
            pageUrl: page?.url ?? null,
          };
        }),

        pages: pages.map((page) => ({
          url: page.url,
          finalUrl: page.finalUrl,
          statusCode: page.statusCode,

          title: page.title,
          metaDescription: page.metaDescription,
          canonicalUrl: page.canonicalUrl,

          wordCount: page.wordCount,
          h1Count: page.h1Count,

          imagesWithoutAlt:
            page.imagesWithoutAlt,

          internalLinksCount:
            page.internalLinksCount,

          responseTimeMs:
            page.responseTimeMs,

          pageScore: page.pageScore,

          isIndexable: page.isIndexable,
        })),
      });

      const generatedAt = new Date();

      const model =
        process.env.GEMINI_MODEL?.trim() ||
        "gemini-3.6-flash";

      /*
       * Stringify before writing.
       *
       * If the column is jsonb, Postgres casts the string back
       * to jsonb. If it's text, it stores the JSON as a string.
       * Either way, we stop the driver from trying to coerce a
       * raw JS object into a type it doesn't know how to bind,
       * which was causing the "Failed query" error.
       */
      await db
        .update(audits)
        .set({
          // aiRecommendations: JSON.stringify(recommendations),
          aiRecommendations: recommendations,
          aiGeneratedAt: generatedAt,
          aiModel: model,
        })
        .where(eq(audits.id, audit.id));

      return NextResponse.json({
        success: true,
        cached: false,
        recommendations,
        generatedAt,
        model,
      });
    } catch (error) {
      /*
       * Refund on any failure after reservation: Gemini call
       * failed, JSON.stringify threw, or the DB write failed.
       * Log for debugging, but don't let a refund failure mask
       * the original error.
       */
      console.error(
        "[ai-recs] generation or persistence failed; refunding credit:",
        error
      );

      try {
        await refundAIRecommendation(user.id);
      } catch (refundError) {
        console.error(
          "[ai-recs] refund failed — user may have been charged for a failed generation:",
          refundError
        );
      }

      throw error;
    }
  } catch (error) {
    console.error("[ai-recs] request failed:", error);

    /*
     * If it's a classified AI error, its message is already
     * user-safe. Return the appropriate status code.
     */
    if (error instanceof AIRecommendationError) {
      const status =
        error.code === "RATE_LIMITED"
          ? 429
          : error.code === "SERVICE_UNAVAILABLE"
            ? 503
            : error.code === "NOT_CONFIGURED"
              ? 500
              : 500;

      return NextResponse.json(
        { error: error.message, code: error.code },
        { status }
      );
    }

    /*
     * Anything else (SQL errors, unexpected exceptions)
     * should never leak internal details to the client.
     * The full error is already logged above.
     */
    return NextResponse.json(
      {
        error:
          "Unable to generate AI recommendations. Please try again.",
      },
      { status: 500 }
    );
  }
}