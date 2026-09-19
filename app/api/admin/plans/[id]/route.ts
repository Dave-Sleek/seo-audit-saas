import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/app/db";
import { plans } from "@/app/db/schema";
import { getCurrentUser } from "@/app/lib/auth";

async function checkAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  if (user.role !== "admin") {
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  return null;
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const authError = await checkAdmin();

    if (authError) {
      return authError;
    }

    const { id } = await context.params;

    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, id))
      .limit(1);

    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error("Admin plan GET error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load plan.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const authError = await checkAdmin();

    if (authError) {
      return authError;
    }

    const { id } = await context.params;

    const body = await request.json();

    const [existingPlan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, id))
      .limit(1);

    if (!existingPlan) {
      return NextResponse.json(
        { error: "Plan not found." },
        { status: 404 }
      );
    }

    const name =
      body.name !== undefined
        ? String(body.name).trim()
        : existingPlan.name;

    const slug =
      body.slug !== undefined
        ? String(body.slug)
            .trim()
            .toLowerCase()
        : existingPlan.slug;

    const description =
      body.description !== undefined
        ? body.description === null
          ? null
          : String(body.description).trim()
        : existingPlan.description;

    const price =
      body.price !== undefined
        ? Number(body.price)
        : existingPlan.price;

    const currency =
      body.currency !== undefined
        ? String(body.currency)
            .trim()
            .toUpperCase()
        : existingPlan.currency;

    const interval =
      body.interval !== undefined
        ? String(body.interval)
            .trim()
            .toLowerCase()
        : existingPlan.interval;

    const auditLimit =
      body.auditLimit !== undefined
        ? Number(body.auditLimit)
        : existingPlan.auditLimit;

    const pagesPerAudit =
      body.pagesPerAudit !== undefined
        ? Number(body.pagesPerAudit)
        : existingPlan.pagesPerAudit;

    const aiRecommendationLimit =
      body.aiRecommendationLimit !== undefined
        ? Number(
            body.aiRecommendationLimit
          )
        : existingPlan.aiRecommendationLimit;

    const maxProjects =
      body.maxProjects !== undefined
        ? Number(body.maxProjects)
        : existingPlan.maxProjects;

    const isActive =
      body.isActive !== undefined
        ? body.isActive === true
        : existingPlan.isActive;

    const isFeatured =
      body.isFeatured !== undefined
        ? body.isFeatured === true
        : existingPlan.isFeatured;

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

    if (slug !== existingPlan.slug) {
      const [duplicate] = await db
        .select()
        .from(plans)
        .where(eq(plans.slug, slug))
        .limit(1);

      if (duplicate) {
        return NextResponse.json(
          {
            error:
              "A plan with this slug already exists.",
          },
          { status: 409 }
        );
      }
    }

    /*
     * Only one plan can be featured.
     */
    if (
      isFeatured &&
      !existingPlan.isFeatured
    ) {
      await db
        .update(plans)
        .set({
          isFeatured: false,
          updatedAt: new Date(),
        })
        .where(eq(plans.isFeatured, true));
    }

    const [updatedPlan] = await db
      .update(plans)
      .set({
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
        updatedAt: new Date(),
      })
      .where(eq(plans.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      plan: updatedPlan,
    });
  } catch (error) {
    console.error(
      "Admin plan PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update plan.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const authError = await checkAdmin();

    if (authError) {
      return authError;
    }

    const { id } = await context.params;

    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, id))
      .limit(1);

    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found." },
        { status: 404 }
      );
    }

    /*
     * We deliberately do NOT physically delete
     * subscription plans.
     *
     * Existing subscriptions may reference them.
     * Deactivate instead.
     */
    const [updatedPlan] = await db
      .update(plans)
      .set({
        isActive: false,
        isFeatured: false,
        updatedAt: new Date(),
      })
      .where(eq(plans.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      message:
        "Plan deactivated successfully.",
      plan: updatedPlan,
    });
  } catch (error) {
    console.error(
      "Admin plan DELETE error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to deactivate plan.",
      },
      { status: 500 }
    );
  }
}