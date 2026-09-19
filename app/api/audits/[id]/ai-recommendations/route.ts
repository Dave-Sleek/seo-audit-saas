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

import { generateSEORecommendations } from "@/app/lib/ai/gemini";

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
        {
          error: "Authentication required.",
        },
        {
          status: 401,
        }
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
        {
          error: "Audit not found.",
        },
        {
          status: 404,
        }
      );
    }

    const audit = result.audit;
    const project = result.project;

    /*
     * If recommendations already exist, return them instead of
     * making another Gemini request.
     */
    let regenerate = false;

    try {
    const body = await request.json();
    regenerate = body?.regenerate === true;
    } catch {
    // Empty request body is allowed.
    }

    if (audit.aiRecommendations && !regenerate) {
      return NextResponse.json({
        success: true,
        cached: true,
        recommendations: audit.aiRecommendations,
        generatedAt: audit.aiGeneratedAt,
        model: audit.aiModel,
      });
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

    const recommendations =
      await generateSEORecommendations({
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
      "gemini-3.8-flash";

    await db
      .update(audits)
      .set({
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
    console.error(
      "AI SEO recommendations API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate AI SEO recommendations.",
      },
      {
        status: 500,
      }
    );
  }
}