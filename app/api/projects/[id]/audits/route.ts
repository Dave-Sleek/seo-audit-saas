import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import { audits, projects } from "@/app/db/schema";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await context.params;

    // ---------------------------------------------------------
    // Authenticate user
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // Find project belonging to the current user
    // ---------------------------------------------------------

    const [project] = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.id, id),
          eq(projects.userId, user.id)
        )
      )
      .limit(1);

    if (!project) {
      return NextResponse.json(
        {
          error: "Project not found.",
        },
        {
          status: 404,
        }
      );
    }

    // ---------------------------------------------------------
    // Load project audits
    // ---------------------------------------------------------

    const projectAudits = await db
      .select()
      .from(audits)
      .where(eq(audits.projectId, project.id))
      .orderBy(desc(audits.createdAt));

    // ---------------------------------------------------------
    // Return response
    // ---------------------------------------------------------

    return NextResponse.json({
      success: true,

      project: {
        id: project.id,
        name: project.name,
        domain: project.domain,
        description: project.description,
        isActive: project.isActive,
      },

      audits: projectAudits.map((audit) => ({
        id: audit.id,
        url: audit.url,

        status: audit.status,

        score: audit.score || 0,

        pagesCrawled:
          audit.pagesCrawled || 0,

        pagesWithErrors:
          audit.pagesWithErrors || 0,

        pagesWithWarnings:
          audit.pagesWithWarnings || 0,

        pagesPassed:
          audit.pagesPassed || 0,

        errorMessage:
          audit.errorMessage,

        createdAt:
          audit.createdAt,

        startedAt:
          audit.startedAt,

        completedAt:
          audit.completedAt,
      })),
    });
  } catch (error) {
    console.error(
      "Project audits error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load audit history.",
      },
      {
        status: 500,
      }
    );
  }
}

