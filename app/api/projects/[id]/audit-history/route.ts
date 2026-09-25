// app/api/projects/[id]/audit-history/route.ts

import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/app/db";
import { audits, projects } from "@/app/db/schema";
import { getCurrentUser } from "@/app/lib/auth";
import { getProjectAccess } from "@/app/lib/project-access";

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
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    /* ---------------------------------------------------------
       Access check — owner OR accepted collaborator.
       Returns 404 (not 403) on deny so we don't leak the
       existence of projects the user can't see.
    --------------------------------------------------------- */

    const access = await getProjectAccess(user.id, id);

    if (!access) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 }
      );
    }

    /* ---------------------------------------------------------
       Load project — no ownership filter now that access is
       confirmed. We still need the row for name + domain.
    --------------------------------------------------------- */

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (!project) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 }
      );
    }

    /* ---------------------------------------------------------
       Load audit history (unchanged)
    --------------------------------------------------------- */

    const history = await db
      .select()
      .from(audits)
      .where(eq(audits.projectId, project.id))
      .orderBy(desc(audits.createdAt));

    const formattedHistory = history.map((audit, index) => {
      const previous = history[index + 1];

      const scoreChange =
        audit.score !== null &&
        previous?.score !== null &&
        previous?.score !== undefined
          ? audit.score - previous.score
          : null;

      return {
        id: audit.id,
        url: audit.url,
        status: audit.status,
        score: audit.score,
        scoreChange,
        pagesCrawled: audit.pagesCrawled,
        pagesWithErrors: audit.pagesWithErrors,
        pagesWithWarnings: audit.pagesWithWarnings,
        pagesPassed: audit.pagesPassed,
        createdAt: audit.createdAt,
        completedAt: audit.completedAt,
      };
    });

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        domain: project.domain,
      },
      history: formattedHistory,
    });
  } catch (error) {
    console.error("Audit history error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load audit history.",
      },
      { status: 500 }
    );
  }
}