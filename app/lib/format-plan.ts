import type { PublicPlan } from "@/app/lib/plans";

/* =========================================================
   PRICE
========================================================= */

/**
 * Plans store price in the smallest currency unit
 * (kobo for NGN, cents for USD).
 *
 * price: 2900000, currency: "NGN" → "₦29,000"
 * price: 2900,    currency: "USD" → "$29"
 */
export function formatPlanPrice(plan: PublicPlan): string {
  const zeroDecimalCurrencies = new Set([
    "JPY",
    "KRW",
    "VND",
    "CLP",
    "ISK",
  ]);

  const isZeroDecimal = zeroDecimalCurrencies.has(plan.currency);

  const amount = isZeroDecimal ? plan.price : plan.price / 100;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: plan.currency,
    minimumFractionDigits: isZeroDecimal ? 0 : 2,
    maximumFractionDigits: isZeroDecimal ? 0 : 2,
  }).format(amount);
}

// export function formatPlanPrice(plan: PublicPlan): string {
//   return new Intl.NumberFormat("en-NG", {
//     style: "currency",
//     currency: plan.currency,
//     minimumFractionDigits: 0,
//     maximumFractionDigits: 0,
//   }).format(plan.price);
// }
/**
 * Returns the suffix shown next to the price.
 * Falls back gracefully for unknown intervals.
 */
export function formatPlanPeriod(plan: PublicPlan): string {
  switch (plan.interval) {
    case "monthly":
      return "per month";
    case "yearly":
    case "annually":
      return "per year";
    case "weekly":
      return "per week";
    case "forever":
      return "forever";
    case "one-time":
      return "one-time";
    default:
      return `per ${plan.interval}`;
  }
}

export function isFreePlan(plan: PublicPlan): boolean {
  return plan.price === 0;
}

/* =========================================================
   LABELS
========================================================= */

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPages(value: number): string {
  if (value >= 10_000) return `${formatNumber(value)}+`;
  return formatNumber(value);
}

export function formatProjects(value: number): string {
  // A very high maxProjects is effectively "unlimited".
  if (value >= 100) return "Unlimited";
  return formatNumber(value);
}