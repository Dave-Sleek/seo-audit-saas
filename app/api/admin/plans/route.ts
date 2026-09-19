import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";

import { db } from "@/app/db";
import { plans } from "@/app/db/schema";
import { getCurrentUser } from "@/app/lib/auth";

async function getAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      ),
    };
  }

  if (user.role !== "admin") {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Administrator access required." },
        { status: 403 }
      ),
    };
  }

  return {
    user,
    response: null,
  };
}

export async function GET() {
  try {
    const { response } = await getAdmin();

    if (response) {
      return response;
    }

    const result = await db
      .select()
      .from(plans)
      .orderBy(asc(plans.price));

    return NextResponse.json({
      success: true,
      plans: result,
    });
  } catch (error) {
    console.error("Admin plans GET error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load plans.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { response } = await getAdmin();

    if (response) {
      return response;
    }

    const body = await request.json();

    const name = String(body.name || "").trim();
    const slug = String(body.slug || "")
      .trim()
      .toLowerCase();

    const description =
      body.description === null ||
      body.description === undefined
        ? null
        : String(body.description).trim();

    const price = Number(body.price);
    const currency = String(
      body.currency || "NGN"
    )
      .trim()
      .toUpperCase();

    const interval = String(
      body.interval || "monthly"
    )
      .trim()
      .toLowerCase();

    const auditLimit = Number(
      body.auditLimit
    );

    const pagesPerAudit = Number(
      body.pagesPerAudit
    );

    const aiRecommendationLimit = Number(
      body.aiRecommendationLimit
    );

    const maxProjects = Number(
      body.maxProjects
    );

    const isActive =
      body.isActive !== false;

    const isFeatured =
      body.isFeatured === true;

    if (!name) {
      return NextResponse.json(
        { error: "Plan name is required." },
        { status: 400 }
      );
    }

    if (!slug) {
      return NextResponse.json(
        { error: "Plan slug is required." },
        { status: 400 }
      );
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        {
          error:
            "Plan slug can only contain lowercase letters, numbers, and hyphens.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(price) ||
      price < 0
    ) {
      return NextResponse.json(
        {
          error:
            "Price must be a valid amount in kobo.",
        },
        { status: 400 }
      );
    }

    if (
      !["monthly", "quarterly", "annually"].includes(
        interval
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Interval must be monthly, quarterly, or annually.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(auditLimit) ||
      auditLimit < 0
    ) {
      return NextResponse.json(
        {
          error:
            "Audit limit must be a non-negative integer.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(pagesPerAudit) ||
      pagesPerAudit < 1
    ) {
      return NextResponse.json(
        {
          error:
            "Pages per audit must be at least 1.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(
        aiRecommendationLimit
      ) ||
      aiRecommendationLimit < 0
    ) {
      return NextResponse.json(
        {
          error:
            "AI recommendation limit must be a non-negative integer.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(maxProjects) ||
      maxProjects < 1
    ) {
      return NextResponse.json(
        {
          error:
            "Maximum projects must be at least 1.",
        },
        { status: 400 }
      );
    }

    const [existingPlan] = await db
      .select()
      .from(plans)
      .where(
        (table, { eq }) =>
          eq(table.slug, slug)
      )
      .limit(1);

    if (existingPlan) {
      return NextResponse.json(
        {
          error:
            "A plan with this slug already exists.",
        },
        { status: 409 }
      );
    }

    /*
     * Only one plan should be featured at a time.
     */
    if (isFeatured) {
      await db
        .update(plans)
        .set({
          isFeatured: false,
          updatedAt: new Date(),
        });
    }

    const [plan] = await db
      .insert(plans)
      .values({
        name,
        slug,
        description,
        price,
        currency,
        interval,
        auditLimit,
        pagesPerAudit,
        aiRecommendationLimit,
        maxProjects,
        isActive,
        isFeatured,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        plan,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin plans POST error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create plan.",
      },
      { status: 500 }
    );
  }
}