import Link from "next/link";

import Navbar from "@/app/components/ui/navbar";
import Footer from "@/app/components/ui/footer";
import SubscribeButton from "@/app/components/ui/subscribe-button";

import { getActivePlans } from "@/app/lib/plans";
import {
  formatPlanPeriod,
  formatPlanPrice,
  isFreePlan,
} from "@/app/lib/format-plan";
import {
  buildComparisonRows,
  getPlanCardFeatures,
} from "@/app/lib/plan-features";

export const dynamic = "force-dynamic";
// Or use `export const revalidate = 300;` if you want a 5-minute cache.

export default async function PricingPage() {
  const planList = await getActivePlans();
  const comparisonRows = buildComparisonRows(planList);

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      <Navbar />

      <main>
        {/* =====================================================
            HEADER
        ====================================================== */}
        <section
          className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
          style={{ background: "#0a0e1a" }}
        >
          <div className="mx-auto max-w-4xl text-center">
            <p
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: "var(--primary)" }}
            >
              Pricing
            </p>

            <h1 className="mt-4 text-4xl font-bold tracking-[-0.03em] text-white sm:text-6xl">
              Simple pricing for better SEO
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-400">
              Start free and upgrade when you need deeper analysis,
              more projects, and larger website crawls.
            </p>
          </div>
        </section>

        {/* =====================================================
            PLANS
        ====================================================== */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {planList.length === 0 ? (
              <div className="stripe-panel text-center">
                <div className="px-6 py-16">
                  <div className="empty-state-title">
                    Pricing coming soon
                  </div>
                  <p className="empty-state-description">
                    We&apos;re finalizing our plans. Check back shortly.
                  </p>
                </div>
              </div>
            ) : (
              <div
                className={`grid gap-6 md:grid-cols-2 ${
                  planList.length === 4
                    ? "lg:grid-cols-4"
                    : planList.length === 3
                      ? "lg:grid-cols-3"
                      : "lg:grid-cols-2"
                }`}
              >
                {planList.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* =====================================================
            COMPARISON
        ====================================================== */}
        {planList.length > 1 && (
          <section
            className="py-20 sm:py-24"
            style={{ background: "var(--background)" }}
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="text-center">
                <h2
                  className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl"
                  style={{ color: "var(--text-primary)" }}
                >
                  Compare plans
                </h2>

                <p
                  className="mt-4"
                  style={{ color: "var(--text-muted)" }}
                >
                  Choose the plan that matches the size of your website
                  operation.
                </p>
              </div>

              <div className="stripe-panel mt-12 overflow-hidden">
                <div
                  className="stripe-table-wrapper"
                  style={{ border: 0, borderRadius: 0 }}
                >
                  <table className="stripe-table">
                    <thead>
                      <tr>
                        <th>Feature</th>
                        {planList.map((plan) => (
                          <th
                            key={plan.id}
                            style={
                              plan.isFeatured
                                ? { color: "var(--primary)" }
                                : undefined
                            }
                          >
                            {plan.name}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {comparisonRows.map((row) => (
                        <tr key={row.label}>
                          <td
                            style={{
                              fontWeight: 500,
                              color: "var(--text-primary)",
                            }}
                          >
                            {row.label}
                          </td>

                          {row.values.map((value, i) => (
                            <td key={`${row.label}-${i}`}>
                              {typeof value === "boolean" ? (
                                value ? (
                                  <span
                                    className="font-semibold"
                                    style={{ color: "var(--success)" }}
                                  >
                                    ✓
                                  </span>
                                ) : (
                                  <span
                                    style={{ color: "var(--text-subtle)" }}
                                  >
                                    —
                                  </span>
                                )
                              ) : (
                                <span
                                  className="tabular-nums"
                                  style={{ color: "var(--text-secondary)" }}
                                >
                                  {value}
                                </span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* =====================================================
            CTA
        ====================================================== */}
        <section className="py-20">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <h2
              className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl"
              style={{ color: "var(--text-primary)" }}
            >
              Not ready to pay?
            </h2>

            <p
              className="mt-4 text-lg"
              style={{ color: "var(--text-muted)" }}
            >
              Start with the free plan and see what your website&apos;s SEO
              looks like.
            </p>

            <Link
              href="/register"
              className="btn-stripe btn-stripe-primary mt-7 inline-flex"
            >
              Start for free
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

/* =========================================================
   PLAN CARD
========================================================= */

function PlanCard({
  plan,
}: {
  plan: Awaited<ReturnType<typeof getActivePlans>>[number];
}) {
  const features = getPlanCardFeatures(plan);
  const featured = plan.isFeatured;

  return (
    <div
      className="relative flex flex-col rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1"
      style={{
        background: "var(--surface)",
        borderColor: featured ? "var(--primary)" : "var(--border)",
        boxShadow: featured
          ? "0 20px 40px -20px rgba(99,91,255,0.35), 0 0 0 1px var(--primary)"
          : undefined,
      }}
    >
      {featured && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold text-white"
          style={{ background: "var(--primary)" }}
        >
          Most popular
        </div>
      )}

      <h2
        className="text-xl font-bold"
        style={{ color: "var(--text-primary)" }}
      >
        {plan.name}
      </h2>

      <p
        className="mt-2 min-h-[48px] text-sm leading-6"
        style={{ color: "var(--text-muted)" }}
      >
        {plan.description ?? ""}
      </p>

      {/* ---------- PRICE — stacked so "per month" never overflows ---------- */}
      <div className="mt-6">
        <div
          className="text-4xl font-bold tracking-[-0.03em] tabular-nums"
          style={{ color: "var(--text-primary)" }}
        >
          {formatPlanPrice(plan)}
        </div>

        <div
          className="mt-1 text-sm"
          style={{ color: "var(--text-subtle)" }}
        >
          {formatPlanPeriod(plan)}
        </div>
      </div>

      {/* ---------- CTA ---------- */}
      <SubscribeButton
        planId={plan.id}
        planSlug={plan.slug}
        planName={plan.name}
        isFree={isFreePlan(plan)}
        isFeatured={featured}
      />

      {/* ---------- FEATURES ---------- */}
      <div
        className="mt-8 border-t pt-6"
        style={{ borderColor: "var(--border)" }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-subtle)" }}
        >
          Includes
        </p>

        <ul className="mt-4 flex flex-col gap-3">
          {features.map((feature) => (
            <li
              key={feature}
              className="flex gap-2 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              <span
                className="shrink-0"
                style={{ color: "var(--success)" }}
                aria-hidden="true"
              >
                ✓
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}