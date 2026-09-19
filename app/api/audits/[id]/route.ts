import { NextResponse } from "next/server";
import {
  and,
  asc,
  eq,
} from "drizzle-orm";

import { getCurrentUser } from "@/app/lib/auth";

import { db } from "@/app/db";

import {
  audits,
  auditPages,
  auditIssues,
  projects,
} from "@/app/db/schema";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const {
      id,
    } = await context.params;

    /* ---------------------------------------------------------
       VALIDATE AUDIT ID
    --------------------------------------------------------- */

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        {
          success: false,

          code:
            "INVALID_AUDIT_ID",

          error:
            "Invalid audit ID.",
        },
        {
          status: 400,
        }
      );
    }

    /* ---------------------------------------------------------
       AUTHENTICATE USER
    --------------------------------------------------------- */

    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,

          code:
            "UNAUTHORIZED",

          error:
            "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    /* ---------------------------------------------------------
       FIND AUDIT BELONGING TO AUTHENTICATED USER
    ---------------------------------------------------------

       IMPORTANT:

       We join audits -> projects and require:

           projects.userId = user.id

       This prevents one user from requesting another
       user's audit by simply knowing the audit ID.
    --------------------------------------------------------- */

    const [
      auditResult,
    ] = await db
      .select()
      .from(audits)
      .innerJoin(
        projects,
        eq(
          audits.projectId,
          projects.id
        )
      )
      .where(
        and(
          eq(
            audits.id,
            id
          ),

          eq(
            projects.userId,
            user.id
          )
        )
      )
      .limit(1);

    if (!auditResult) {
      return NextResponse.json(
        {
          success: false,

          code:
            "AUDIT_NOT_FOUND",

          error:
            "Audit not found.",
        },
        {
          status: 404,
        }
      );
    }

    /* ---------------------------------------------------------
       GET AUDIT / PROJECT RECORDS
    --------------------------------------------------------- */

    const auditRecord =
      auditResult.audits;

    const projectRecord =
      auditResult.projects;

    /* ---------------------------------------------------------
       GET CRAWLED PAGES
    --------------------------------------------------------- */

    const pages =
      await db
        .select()
        .from(auditPages)
        .where(
          eq(
            auditPages.auditId,
            auditRecord.id
          )
        )
        .orderBy(
          asc(
            auditPages.createdAt
          )
        );

    /* ---------------------------------------------------------
       GET AUDIT ISSUES
    --------------------------------------------------------- */

    const issues =
      await db
        .select()
        .from(auditIssues)
        .where(
          eq(
            auditIssues.auditId,
            auditRecord.id
          )
        )
        .orderBy(
          asc(
            auditIssues.createdAt
          )
        );

    /* ---------------------------------------------------------
       GROUP ISSUES BY PAGE
    --------------------------------------------------------- */

    const pageIssues =
      new Map<
        string,
        typeof issues
      >();

    for (
      const issue of issues
    ) {
      if (!issue.pageId) {
        continue;
      }

      if (
        !pageIssues.has(
          issue.pageId
        )
      ) {
        pageIssues.set(
          issue.pageId,
          []
        );
      }

      pageIssues
        .get(issue.pageId)!
        .push(issue);
    }

    /* ---------------------------------------------------------
       RETURN AUDIT REPORT
    --------------------------------------------------------- */

    return NextResponse.json({
      success: true,

      project: {
        id:
          projectRecord.id,

        name:
          projectRecord.name,

        domain:
          projectRecord.domain,
      },

      audit: {
        id:
          auditRecord.id,

        url:
          auditRecord.url,

        status:
          auditRecord.status,

        score:
          auditRecord.score ??
          0,

        pagesCrawled:
          auditRecord.pagesCrawled ??
          0,

        pagesWithErrors:
          auditRecord.pagesWithErrors ??
          0,

        pagesWithWarnings:
          auditRecord.pagesWithWarnings ??
          0,

        pagesPassed:
          auditRecord.pagesPassed ??
          0,

        errorMessage:
          auditRecord.errorMessage,

        createdAt:
          auditRecord.createdAt,

        startedAt:
          auditRecord.startedAt,

        completedAt:
          auditRecord.completedAt,
      },

      /* -------------------------------------------------------
         PAGES
      ------------------------------------------------------- */

      pages:
        pages.map(
          (page) => ({
            id:
              page.id,

            url:
              page.url,

            finalUrl:
              page.finalUrl,

            statusCode:
              page.statusCode,

            contentType:
              page.contentType,

            redirectCount:
              page.redirectCount,

            redirectChain:
              page.redirectChain,

            responseTimeMs:
              page.responseTimeMs,

            score:
              page.pageScore ??
              0,

            title:
              page.title,

            titleLength:
              page.titleLength,

            metaDescription:
              page.metaDescription,

            metaDescriptionLength:
              page.metaDescriptionLength,

            canonicalUrl:
              page.canonicalUrl,

            robotsMeta:
              page.robotsMeta,

            h1:
              page.h1,

            h1Count:
              page.h1Count,

            h2Count:
              page.h2Count,

            wordCount:
              page.wordCount,

            internalLinksCount:
              page.internalLinksCount,

            externalLinksCount:
              page.externalLinksCount,

            imagesCount:
              page.imagesCount,

            imagesWithoutAlt:
              page.imagesWithoutAlt,

            hasHttps:
              page.hasHttps,

            hasSchema:
              page.hasSchema,

            hasOpenGraph:
              page.hasOpenGraph,

            hasTwitterCard:
              page.hasTwitterCard,

            isIndexable:
              page.isIndexable,

            issues:
              pageIssues
                .get(page.id)
                ?.map(
                  (issue) => ({
                    id:
                      issue.id,

                    category:
                      issue.category,

                    type:
                      issue.type,

                    severity:
                      issue.severity,

                    title:
                      issue.title,

                    description:
                      issue.description,

                    recommendation:
                      issue.recommendation,
                  })
                ) ??
              [],
          })
        ),

      /* -------------------------------------------------------
         ALL ISSUES
      ------------------------------------------------------- */

      issues:
        issues.map(
          (issue) => {
            const page =
              pages.find(
                (item) =>
                  item.id ===
                  issue.pageId
              );

            return {
              id:
                issue.id,

              pageId:
                issue.pageId,

              url:
                page?.url ??
                null,

              category:
                issue.category,

              type:
                issue.type,

              severity:
                issue.severity,

              title:
                issue.title,

              description:
                issue.description,

              recommendation:
                issue.recommendation,
            };
          }
        ),
    });
  } catch (error) {
    console.error(
      "Audit report error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        code:
          "AUDIT_REPORT_FAILED",

        error:
          error instanceof Error
            ? error.message
            : "Unable to load audit.",
      },
      {
        status: 500,
      }
    );
  }
}