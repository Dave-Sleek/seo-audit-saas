import { NextResponse } from "next/server";

import {
    getUsageSummary,
} from "@/app/lib/usage";

import {
    getCurrentUser,
} from "@/app/lib/auth";

/**
 * Always return fresh subscription/usage information.
 */
export const dynamic =
    "force-dynamic";

/**
 * ============================================================
 * GET /api/subscription/usage
 * ============================================================
 */
export async function GET() {
    try {
        /*
         * Never accept userId from the client.
         *
         * The authenticated session determines which user's
         * subscription and usage information is returned.
         */
        const user =
            await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                {
                    success: false,

                    message:
                        "Unauthorized",
                },
                {
                    status: 401,
                }
            );
        }

        const summary =
            await getUsageSummary(
                user.id
            );

        /**
         * ====================================================
         * NO ACTIVE SUBSCRIPTION
         * ====================================================
         */
        if (
            !summary.subscription ||
            !summary.plan ||
            !summary.usage
        ) {
            return NextResponse.json({
                success: true,

                hasSubscription: false,

                subscription: null,

                plan: null,

                usage: {
                    auditsUsed: 0,

                    pagesCrawled: 0,

                    aiRecommendationsUsed: 0,

                    projectsUsed:
                        summary.projectsUsed,
                },

                limits: {
                    audits: 0,

                    pagesPerAudit: 0,

                    aiRecommendations: 0,

                    projects: 0,
                },

                remaining: {
                    audits: 0,

                    aiRecommendations: 0,

                    projects: 0,
                },

                /*
                 * pagesPerAudit is an audit-level limit,
                 * so there is intentionally no
                 * pagesRemaining value here.
                 */
                projectsUsed:
                    summary.projectsUsed,
            });
        }

        /**
         * ====================================================
         * REMAINING USAGE
         * ====================================================
         */

        const auditsRemaining =
            Math.max(
                0,

                summary.plan.auditLimit -
                    summary.usage.auditsUsed
            );

        const aiRecommendationsRemaining =
            Math.max(
                0,

                summary.plan
                    .aiRecommendationLimit -
                    summary.usage
                        .aiRecommendationsUsed
            );

        const projectsRemaining =
            Math.max(
                0,

                summary.plan.maxProjects -
                    summary.projectsUsed
            );

        /**
         * ====================================================
         * RESPONSE
         * ====================================================
         */
        return NextResponse.json({
            success: true,

            hasSubscription: true,

            subscription: {
                id:
                    summary.subscription.id,

                status:
                    summary.subscription.status,

                startsAt:
                    summary.subscription
                        .startsAt,

                endsAt:
                    summary.subscription
                        .endsAt,
            },

            plan: {
                id:
                    summary.plan.id,

                name:
                    summary.plan.name,

                slug:
                    summary.plan.slug,

                currency:
                    summary.plan.currency,

                interval:
                    summary.plan.interval,
            },

            usage: {
                id:
                    summary.usage.id,

                periodStart:
                    summary.usage
                        .periodStart,

                periodEnd:
                    summary.usage
                        .periodEnd,

                auditsUsed:
                    summary.usage
                        .auditsUsed,

                /*
                 * Reporting metric only.
                 */
                pagesCrawled:
                    summary.usage
                        .pagesCrawled,

                aiRecommendationsUsed:
                    summary.usage
                        .aiRecommendationsUsed,

                projectsUsed:
                    summary.projectsUsed,
            },

            limits: {
                audits:
                    summary.plan
                        .auditLimit,

                /*
                 * Hard limit for EACH audit.
                 */
                pagesPerAudit:
                    summary.plan
                        .pagesPerAudit,

                aiRecommendations:
                    summary.plan
                        .aiRecommendationLimit,

                projects:
                    summary.plan
                        .maxProjects,
            },

            remaining: {
                audits:
                    auditsRemaining,

                aiRecommendations:
                    aiRecommendationsRemaining,

                projects:
                    projectsRemaining,
            },
        });
    } catch (error) {
        console.error(
            "GET /api/subscription/usage error:",
            error
        );

        return NextResponse.json(
            {
                success: false,

                message:
                    "Unable to retrieve subscription usage.",
            },
            {
                status: 500,
            }
        );
    }
}