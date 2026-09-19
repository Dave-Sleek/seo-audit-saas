import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/app/db";
import {
  audits,
  projects,
} from "@/app/db/schema";
import { getCurrentUser } from "@/app/lib/auth";

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
        { error: "Project not found." },
        { status: 404 }
      );
    }

    const history = await db
      .select()
      .from(audits)
      .where(eq(audits.projectId, project.id))
      .orderBy(desc(audits.createdAt));

    const formattedHistory = history.map(
      (audit, index) => {
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
          pagesWithWarnings:
            audit.pagesWithWarnings,
          pagesPassed: audit.pagesPassed,
          createdAt: audit.createdAt,
          completedAt: audit.completedAt,
        };
      }
    );

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
    console.error(
      "Audit history error:",
      error
    );

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