import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/app/db";
import {
  audits,
  auditIssues,
  auditLinks,
  auditPages,
  projects,
} from "@/app/db/schema";

import { getCurrentUser } from "@/app/lib/auth";

import {
  analyzeSitewide,
  type SitewideLink,
  type SitewidePage,
} from "@/app/lib/seo/sitewide-analyzer";

export async function GET(
  _request: Request,
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
        { status: 401 }
      );
    }

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
        { status: 404 }
      );
    }

    const pages = await db
      .select()
      .from(auditPages)
      .where(eq(auditPages.auditId, id))
      .orderBy(asc(auditPages.createdAt));

    const links = await db
      .select()
      .from(auditLinks)
      .where(eq(auditLinks.auditId, id));

    const sitewidePages: SitewidePage[] =
      pages.map((page) => ({
        id: page.id,
        url: page.url,
        finalUrl: page.finalUrl,
        statusCode: page.statusCode,

        title: page.title,
        titleLength: page.titleLength,

        metaDescription:
          page.metaDescription,
        metaDescriptionLength:
          page.metaDescriptionLength,

        canonicalUrl: page.canonicalUrl,

        wordCount: page.wordCount,

        internalLinksCount:
          page.internalLinksCount,

        redirectCount:
          page.redirectCount,

        redirectChain:
          page.redirectChain,

        pageScore: page.pageScore,

        isIndexable: page.isIndexable,
      }));

    const sitewideLinks: SitewideLink[] =
      links.map((link) => ({
        sourcePageId:
          link.sourcePageId,

        sourceUrl:
          link.sourceUrl,

        targetUrl:
          link.targetUrl,

        normalizedTargetUrl:
          link.normalizedTargetUrl,

        anchorText:
          link.anchorText,

        isInternal:
          link.isInternal,

        targetStatusCode:
          link.targetStatusCode,

        targetPageId:
          link.targetPageId,

        isBroken:
          link.isBroken,
      }));

    const analysis = analyzeSitewide(
      sitewidePages,
      sitewideLinks
    );

    return NextResponse.json({
      success: true,

      project: {
        id: result.project.id,
        name: result.project.name,
        domain: result.project.domain,
      },

      audit: {
        id: result.audit.id,
        score: result.audit.score,
        sitewideScore:
          analysis.score,
        pagesCrawled:
          result.audit.pagesCrawled,
        createdAt:
          result.audit.createdAt,
      },

      analysis,
    });
  } catch (error) {
    console.error(
      "Sitewide SEO analysis error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to analyze the website.",
      },
      { status: 500 }
    );
  }
}