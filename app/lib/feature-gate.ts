import {
    checkAuditLimit,
    checkProjectLimit,
    checkAIRecommendationLimit,
    getUsageSummary,
} from "@/app/lib/usage";

/**
 * ============================================================
 * FEATURES
 * ============================================================
 */

export type Feature =
    | "audits"
    | "projects"
    | "ai_recommendations";

/**
 * ============================================================
 * FEATURE ACCESS
 * ============================================================
 */

export interface FeatureAccess {
    allowed: boolean;

    code:
        | "NO_SUBSCRIPTION"
        | "AUDIT_LIMIT_REACHED"
        | "PROJECT_LIMIT_REACHED"
        | "AI_RECOMMENDATION_LIMIT_REACHED"
        | null;

    message: string | null;

    used: number;

    limit: number;

    remaining: number;
}

/**
 * ============================================================
 * AUDITS
 * ============================================================
 *
 * IMPORTANT:
 *
 * canRunAudit() is a PREFLIGHT check.
 *
 * It does not reserve an audit.
 *
 * The audit API must still call consumeAudit() and use that
 * atomic result as the authoritative decision.
 */
export async function canRunAudit(
    userId: string
): Promise<FeatureAccess> {
    const summary =
        await getUsageSummary(
            userId
        );

    if (
        !summary.subscription ||
        !summary.plan ||
        !summary.usage
    ) {
        return {
            allowed: false,

            code:
                "NO_SUBSCRIPTION",

            message:
                "An active subscription is required to run an SEO audit.",

            used: 0,

            limit: 0,

            remaining: 0,
        };
    }

    const result =
        await checkAuditLimit(
            userId
        );

    if (!result.allowed) {
        return {
            allowed: false,

            code:
                "AUDIT_LIMIT_REACHED",

            message:
                result.message ??
                "You have reached your audit limit for the current subscription period.",

            used:
                result.used,

            limit:
                result.limit,

            remaining:
                result.remaining,
        };
    }

    return {
        allowed: true,

        code: null,

        message: null,

        used:
            result.used,

        limit:
            result.limit,

        remaining:
            result.remaining,
    };
}

/**
 * ============================================================
 * PROJECTS
 * ============================================================
 *
 * This is also a preflight check.
 *
 * The actual project creation operation must still enforce
 * the limit at creation time.
 */
export async function canCreateProject(
    userId: string
): Promise<FeatureAccess> {
    const summary =
        await getUsageSummary(
            userId
        );

    if (
        !summary.subscription ||
        !summary.plan
    ) {
        return {
            allowed: false,

            code:
                "NO_SUBSCRIPTION",

            message:
                "An active subscription is required to create a project.",

            used:
                summary.projectsUsed,

            limit: 0,

            remaining: 0,
        };
    }

    const result =
        await checkProjectLimit(
            userId
        );

    if (!result.allowed) {
        return {
            allowed: false,

            code:
                "PROJECT_LIMIT_REACHED",

            message:
                result.message ??
                "You have reached the maximum number of projects allowed by your current plan.",

            used:
                result.used,

            limit:
                result.limit,

            remaining:
                result.remaining,
        };
    }

    return {
        allowed: true,

        code: null,

        message: null,

        used:
            result.used,

        limit:
            result.limit,

        remaining:
            result.remaining,
    };
}

/**
 * ============================================================
 * AI RECOMMENDATIONS
 * ============================================================
 *
 * Preflight check only.
 *
 * The actual AI endpoint must call consumeAIRecommendation()
 * immediately before making the billable/limited AI request.
 */
export async function canUseAIRecommendations(
    userId: string
): Promise<FeatureAccess> {
    const summary =
        await getUsageSummary(
            userId
        );

    if (
        !summary.subscription ||
        !summary.plan ||
        !summary.usage
    ) {
        return {
            allowed: false,

            code:
                "NO_SUBSCRIPTION",

            message:
                "An active subscription is required to use AI recommendations.",

            used: 0,

            limit: 0,

            remaining: 0,
        };
    }

    const result =
        await checkAIRecommendationLimit(
            userId
        );

    if (!result.allowed) {
        return {
            allowed: false,

            code:
                "AI_RECOMMENDATION_LIMIT_REACHED",

            message:
                result.message ??
                "You have reached your AI recommendation limit for the current subscription period.",

            used:
                result.used,

            limit:
                result.limit,

            remaining:
                result.remaining,
        };
    }

    return {
        allowed: true,

        code: null,

        message: null,

        used:
            result.used,

        limit:
            result.limit,

        remaining:
            result.remaining,
    };
}

/**
 * ============================================================
 * GENERIC FEATURE CHECK
 * ============================================================
 */
export async function canUseFeature(
    userId: string,
    feature: Feature
): Promise<FeatureAccess> {
    switch (feature) {
        case "audits":
            return canRunAudit(
                userId
            );

        case "projects":
            return canCreateProject(
                userId
            );

        case "ai_recommendations":
            return canUseAIRecommendations(
                userId
            );

        default:
            throw new Error(
                `Unsupported feature: ${feature}`
            );
    }
}