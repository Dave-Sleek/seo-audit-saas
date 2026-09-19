import { and, asc, eq } from "drizzle-orm";

import { db } from "@/app/db";
import { plans } from "@/app/db/schema";

/* =========================================================
   TYPES
========================================================= */

export type Plan = typeof plans.$inferSelect;

export type PublicPlan = Pick<
  Plan,
  | "id"
  | "name"
  | "slug"
  | "description"
  | "price"
  | "currency"
  | "interval"
  | "auditLimit"
  | "pagesPerAudit"
  | "aiRecommendationLimit"
  | "maxProjects"
  | "isFeatured"
>;

/* =========================================================
   QUERIES
========================================================= */

/**
 * All active plans, cheapest first.
 * Used by the public pricing page.
 */
export async function getActivePlans(): Promise<PublicPlan[]> {
  const rows = await db
    .select({
      id: plans.id,
      name: plans.name,
      slug: plans.slug,
      description: plans.description,
      price: plans.price,
      currency: plans.currency,
      interval: plans.interval,
      auditLimit: plans.auditLimit,
      pagesPerAudit: plans.pagesPerAudit,
      aiRecommendationLimit: plans.aiRecommendationLimit,
      maxProjects: plans.maxProjects,
      isFeatured: plans.isFeatured,
    })
    .from(plans)
    .where(eq(plans.isActive, true))
    .orderBy(asc(plans.price));

  return rows;
}

/**
 * One plan by slug, only if active.
 * Used by the checkout flow.
 */
export async function getActivePlanBySlug(
  slug: string
): Promise<PublicPlan | null> {
  const rows = await db
    .select({
      id: plans.id,
      name: plans.name,
      slug: plans.slug,
      description: plans.description,
      price: plans.price,
      currency: plans.currency,
      interval: plans.interval,
      auditLimit: plans.auditLimit,
      pagesPerAudit: plans.pagesPerAudit,
      aiRecommendationLimit: plans.aiRecommendationLimit,
      maxProjects: plans.maxProjects,
      isFeatured: plans.isFeatured,
    })
    .from(plans)
    .where(and(eq(plans.slug, slug), eq(plans.isActive, true)))
    .limit(1);

  return rows[0] ?? null;
}