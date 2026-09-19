import type { PublicPlan } from "@/app/lib/plans";
import {
  formatNumber,
  formatPages,
  formatProjects,
} from "@/app/lib/format-plan";

/* =========================================================
   CARD FEATURES
========================================================= */

/**
 * Feature bullets shown on each pricing card.
 * Generated from the plan's actual values so they
 * can never drift out of sync with the plan config.
 */
export function getPlanCardFeatures(plan: PublicPlan): string[] {
  const features: string[] = [];

  features.push(
    `${formatProjects(plan.maxProjects)} project${
      plan.maxProjects === 1 ? "" : "s"
    }`
  );

  features.push(
    `${formatPages(plan.pagesPerAudit)} pages per audit`
  );

  features.push(
    `${formatNumber(plan.auditLimit)} audit${
      plan.auditLimit === 1 ? "" : "s"
    } per ${plan.interval === "yearly" ? "year" : "month"}`
  );

  if (plan.aiRecommendationLimit > 0) {
    features.push(
      `${formatNumber(
        plan.aiRecommendationLimit
      )} AI recommendation${
        plan.aiRecommendationLimit === 1 ? "" : "s"
      } per period`
    );
  }

  // Feature tiers that increase with plan price.
  // Uses price as a proxy for tier since we don't have
  // explicit boolean feature flags on the plan table.
  const tier = plan.price;

  if (tier > 0) {
    features.push("Full audit history");
    features.push("Exportable reports");
  } else {
    features.push("Basic audit history");
  }

  if (tier >= 2900) {
    features.push("Priority crawling");
    features.push("Detailed issue insights");
  }

  if (tier >= 7900) {
    features.push("Team features");
    features.push("Priority support");
  }

  return features;
}

/* =========================================================
   COMPARISON ROWS
========================================================= */

type ComparisonValue = string | boolean;

export type ComparisonRow = {
  label: string;
  values: ComparisonValue[];
};

/**
 * Comparison table rows for a set of plans.
 * The row order is fixed, values are derived per plan.
 */
export function buildComparisonRows(
  planList: PublicPlan[]
): ComparisonRow[] {
  const rows: Omit<ComparisonRow, "values">[] & {
    get: (plan: PublicPlan) => ComparisonValue;
  }[] = [];

  const definitions: {
    label: string;
    get: (plan: PublicPlan) => ComparisonValue;
  }[] = [
    {
      label: "Projects",
      get: (plan) => formatProjects(plan.maxProjects),
    },
    {
      label: "Pages per audit",
      get: (plan) => formatPages(plan.pagesPerAudit),
    },
    {
      label: "Audits per period",
      get: (plan) => formatNumber(plan.auditLimit),
    },
    {
      label: "AI recommendations",
      get: (plan) =>
        plan.aiRecommendationLimit === 0
          ? false
          : formatNumber(plan.aiRecommendationLimit),
    },
    {
      label: "SEO score",
      get: () => true,
    },
    {
      label: "Technical SEO checks",
      get: () => true,
    },
    {
      label: "On-page analysis",
      get: () => true,
    },
    {
      label: "Structured data checks",
      get: () => true,
    },
    {
      label: "Social metadata checks",
      get: () => true,
    },
    {
      label: "Audit history",
      get: (plan) => plan.price > 0,
    },
    {
      label: "Exportable reports",
      get: (plan) => plan.price > 0,
    },
    {
      label: "Priority crawling",
      get: (plan) => plan.price >= 2900,
    },
    {
      label: "Team features",
      get: (plan) => plan.price >= 7900,
    },
    {
      label: "Priority support",
      get: (plan) => plan.price >= 7900,
    },
  ];

  return definitions.map((def) => ({
    label: def.label,
    values: planList.map((plan) => def.get(plan)),
  }));
}