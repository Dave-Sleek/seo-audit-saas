import {
  and,
  eq,
  gt,
  lte,
  sql,
} from "drizzle-orm";

import { db } from "@/app/db";

import {
  plans,
  projects,
  subscriptionUsage,
  subscriptions,
} from "@/app/db/schema";

/* =========================================================
   TYPES
========================================================= */

export type UsageLimitType =
  | "audits"
  | "pages"
  | "ai_recommendations"
  | "projects";

export type UsageResult = {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  message?: string;
};

export type UsageSummary = {
  subscription: {
    id: string;
    status: string;
    startsAt: Date;
    endsAt: Date;
  } | null;

  plan: {
    id: string;
    name: string;
    slug: string;

    currency: string;
    interval: string;

    auditLimit: number;
    pagesPerAudit: number;
    aiRecommendationLimit: number;
    maxProjects: number;
  } | null;

  usage: {
    id: string;
    periodStart: Date;
    periodEnd: Date;

    auditsUsed: number;
    pagesCrawled: number;
    aiRecommendationsUsed: number;
  } | null;

  limits: {
    audits: number;
    pagesPerAudit: number;
    aiRecommendations: number;
    projects: number;
  };

  projectsUsed: number;
};

export type AuditReservationResult = {
  allowed: boolean;

  code:
    | "NO_SUBSCRIPTION"
    | "AUDIT_LIMIT_REACHED"
    | "PROJECT_LIMIT_REACHED"
    | null;

  message: string | null;

  project: typeof projects.$inferSelect | null;

  projectCreated: boolean;

  plan: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    interval: string;
    auditLimit: number;
    pagesPerAudit: number;
    aiRecommendationLimit: number;
    maxProjects: number;
  } | null;

  auditUsage: UsageResult;

  projectUsage: UsageResult;
};

/**
 * Internal shape carried by the reservation failure holder.
 */
type ReservationFailure = {
  kind:
    | "NO_SUBSCRIPTION"
    | "AUDIT_LIMIT_REACHED"
    | "PROJECT_LIMIT_REACHED";

  plan: typeof plans.$inferSelect | null;

  auditUsed: number;
  auditLimit: number;

  projectUsed: number;
  projectLimit: number;

  message: string;
};

/* =========================================================
   INTERNAL HELPERS
========================================================= */

async function getActiveSubscriptionWithPlan(userId: string) {
  const now = new Date();

  await db
    .update(subscriptions)
    .set({
      status: "expired",
      updatedAt: now,
    })
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active"),
        lte(subscriptions.endsAt, now)
      )
    );

  const result = await db
    .select({
      subscription: subscriptions,
      plan: plans,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active"),
        lte(subscriptions.startsAt, now),
        gt(subscriptions.endsAt, now)
      )
    )
    .orderBy(sql`${subscriptions.endsAt} DESC`)
    .limit(1);

  return result[0] ?? null;
}

async function ensureUsagePeriod(
  userId: string,
  subscriptionId: string,
  periodStart: Date,
  periodEnd: Date
) {
  const existing = await db
    .select()
    .from(subscriptionUsage)
    .where(
      and(
        eq(subscriptionUsage.subscriptionId, subscriptionId),
        eq(subscriptionUsage.periodStart, periodStart),
        eq(subscriptionUsage.periodEnd, periodEnd)
      )
    )
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const inserted = await db
    .insert(subscriptionUsage)
    .values({
      subscriptionId,
      userId,
      periodStart,
      periodEnd,
      auditsUsed: 0,
      pagesCrawled: 0,
      aiRecommendationsUsed: 0,
    })
    .onConflictDoNothing({
      target: [
        subscriptionUsage.subscriptionId,
        subscriptionUsage.periodStart,
        subscriptionUsage.periodEnd,
      ],
    })
    .returning();

  if (inserted[0]) {
    return inserted[0];
  }

  const retry = await db
    .select()
    .from(subscriptionUsage)
    .where(
      and(
        eq(subscriptionUsage.subscriptionId, subscriptionId),
        eq(subscriptionUsage.periodStart, periodStart),
        eq(subscriptionUsage.periodEnd, periodEnd)
      )
    )
    .limit(1);

  return retry[0] ?? null;
}

async function getActiveProjectCount(userId: string): Promise<number> {
  const result = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(projects)
    .where(
      and(eq(projects.userId, userId), eq(projects.isActive, true))
    );

  return Number(result[0]?.count ?? 0);
}

/* =========================================================
   GET CURRENT USAGE
========================================================= */

export async function getUsageSummary(
  userId: string
): Promise<UsageSummary> {
  const active = await getActiveSubscriptionWithPlan(userId);
  const projectsUsed = await getActiveProjectCount(userId);

  if (!active) {
    return {
      subscription: null,
      plan: null,
      usage: null,
      limits: {
        audits: 0,
        pagesPerAudit: 0,
        aiRecommendations: 0,
        projects: 0,
      },
      projectsUsed,
    };
  }

  const usage = await ensureUsagePeriod(
    userId,
    active.subscription.id,
    active.subscription.startsAt,
    active.subscription.endsAt
  );

  return {
    subscription: {
      id: active.subscription.id,
      status: active.subscription.status,
      startsAt: active.subscription.startsAt,
      endsAt: active.subscription.endsAt,
    },

    plan: {
      id: active.plan.id,
      name: active.plan.name,
      slug: active.plan.slug,
      currency: active.plan.currency,
      interval: active.plan.interval,
      auditLimit: active.plan.auditLimit,
      pagesPerAudit: active.plan.pagesPerAudit,
      aiRecommendationLimit: active.plan.aiRecommendationLimit,
      maxProjects: active.plan.maxProjects,
    },

    usage: usage
      ? {
          id: usage.id,
          periodStart: usage.periodStart,
          periodEnd: usage.periodEnd,
          auditsUsed: usage.auditsUsed,
          pagesCrawled: usage.pagesCrawled,
          aiRecommendationsUsed: usage.aiRecommendationsUsed,
        }
      : null,

    limits: {
      audits: active.plan.auditLimit,
      pagesPerAudit: active.plan.pagesPerAudit,
      aiRecommendations: active.plan.aiRecommendationLimit,
      projects: active.plan.maxProjects,
    },

    projectsUsed,
  };
}

/* =========================================================
   AUDIT LIMIT — PREFLIGHT
========================================================= */

export async function checkAuditLimit(
  userId: string
): Promise<UsageResult> {
  const active = await getActiveSubscriptionWithPlan(userId);

  if (!active) {
    return {
      allowed: false,
      used: 0,
      limit: 0,
      remaining: 0,
      message: "You need an active subscription to create an audit.",
    };
  }

  const usage = await ensureUsagePeriod(
    userId,
    active.subscription.id,
    active.subscription.startsAt,
    active.subscription.endsAt
  );

  if (!usage) {
    return {
      allowed: false,
      used: 0,
      limit: active.plan.auditLimit,
      remaining: active.plan.auditLimit,
      message: "Unable to initialize your usage period.",
    };
  }

  const used = usage.auditsUsed;
  const limit = active.plan.auditLimit;

  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    message:
      used >= limit
        ? `You have reached your ${active.plan.name} audit limit.`
        : undefined,
  };
}

/* =========================================================
   CONSUME AUDIT
========================================================= */

export async function consumeAudit(
  userId: string
): Promise<UsageResult> {
  const active = await getActiveSubscriptionWithPlan(userId);

  if (!active) {
    return {
      allowed: false,
      used: 0,
      limit: 0,
      remaining: 0,
      message: "You need an active subscription to create an audit.",
    };
  }

  const usage = await ensureUsagePeriod(
    userId,
    active.subscription.id,
    active.subscription.startsAt,
    active.subscription.endsAt
  );

  if (!usage) {
    throw new Error("Unable to initialize subscription usage.");
  }

  const limit = active.plan.auditLimit;

  const updated = await db
    .update(subscriptionUsage)
    .set({
      auditsUsed: sql`${subscriptionUsage.auditsUsed} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(subscriptionUsage.id, usage.id),
        sql`${subscriptionUsage.auditsUsed} < ${limit}`
      )
    )
    .returning();

  if (!updated[0]) {
    const latest = await db
      .select()
      .from(subscriptionUsage)
      .where(eq(subscriptionUsage.id, usage.id))
      .limit(1);

    const used = latest[0]?.auditsUsed ?? limit;

    return {
      allowed: false,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      message: `You have reached your ${active.plan.name} audit limit.`,
    };
  }

  const used = updated[0].auditsUsed;

  return {
    allowed: true,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

/* =========================================================
   ATOMIC AUDIT + PROJECT RESERVATION
========================================================= */

export async function reserveAuditAndProject(
  userId: string,
  projectData: {
    name: string;
    domain: string;
    description?: string;
    isActive?: boolean;
  }
): Promise<AuditReservationResult> {
  /*
   * Use an object wrapper instead of a bare `let`.
   *
   * TypeScript's control-flow analysis can narrow object
   * property access across the try/catch boundary, but NOT
   * a `let` variable assigned inside a closure.
   */
  const failureHolder: { value: ReservationFailure | null } = {
    value: null,
  };

  try {
    return await db.transaction(async (tx) => {
      /* 1. Serialize quota/project operations for this user */
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`
      );

      const now = new Date();

      /* 2. Expire old active subscriptions */
      await tx
        .update(subscriptions)
        .set({ status: "expired", updatedAt: now })
        .where(
          and(
            eq(subscriptions.userId, userId),
            eq(subscriptions.status, "active"),
            lte(subscriptions.endsAt, now)
          )
        );

      /* 3. Load active subscription + plan */
      const activeResult = await tx
        .select({
          subscription: subscriptions,
          plan: plans,
        })
        .from(subscriptions)
        .innerJoin(plans, eq(subscriptions.planId, plans.id))
        .where(
          and(
            eq(subscriptions.userId, userId),
            eq(subscriptions.status, "active"),
            lte(subscriptions.startsAt, now),
            gt(subscriptions.endsAt, now)
          )
        )
        .orderBy(sql`${subscriptions.endsAt} DESC`)
        .limit(1);

      const active = activeResult[0];

      if (!active) {
        failureHolder.value = {
          kind: "NO_SUBSCRIPTION",
          plan: null,
          auditUsed: 0,
          auditLimit: 0,
          projectUsed: 0,
          projectLimit: 0,
          message:
            "An active subscription is required to run an SEO audit.",
        };
        throw new Error("__AUDIT_RESERVATION_ROLLBACK__");
      }

      const plan = active.plan;

      /* 4. Ensure subscription usage row exists */
      let usage = (
        await tx
          .select()
          .from(subscriptionUsage)
          .where(
            and(
              eq(subscriptionUsage.subscriptionId, active.subscription.id),
              eq(subscriptionUsage.periodStart, active.subscription.startsAt),
              eq(subscriptionUsage.periodEnd, active.subscription.endsAt)
            )
          )
          .limit(1)
      )[0];

      if (!usage) {
        const inserted = await tx
          .insert(subscriptionUsage)
          .values({
            subscriptionId: active.subscription.id,
            userId,
            periodStart: active.subscription.startsAt,
            periodEnd: active.subscription.endsAt,
            auditsUsed: 0,
            pagesCrawled: 0,
            aiRecommendationsUsed: 0,
          })
          .onConflictDoNothing({
            target: [
              subscriptionUsage.subscriptionId,
              subscriptionUsage.periodStart,
              subscriptionUsage.periodEnd,
            ],
          })
          .returning();

        usage =
          inserted[0] ??
          (
            await tx
              .select()
              .from(subscriptionUsage)
              .where(
                and(
                  eq(
                    subscriptionUsage.subscriptionId,
                    active.subscription.id
                  ),
                  eq(
                    subscriptionUsage.periodStart,
                    active.subscription.startsAt
                  ),
                  eq(
                    subscriptionUsage.periodEnd,
                    active.subscription.endsAt
                  )
                )
              )
              .limit(1)
          )[0];
      }

      if (!usage) {
        throw new Error("USAGE_PERIOD_INIT_FAILED");
      }

      const auditUsed = usage.auditsUsed;
      const auditLimit = plan.auditLimit;

      /* Check Audit Quota */
      if (auditUsed >= auditLimit) {
        failureHolder.value = {
          kind: "AUDIT_LIMIT_REACHED",
          plan,
          auditUsed,
          auditLimit,
          projectUsed: 0,
          projectLimit: plan.maxProjects,
          message: `You have reached your ${plan.name} audit limit.`,
        };
        throw new Error("__AUDIT_RESERVATION_ROLLBACK__");
      }

      /* 5. Look up existing project */
      const existingProjects = await tx
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.userId, userId),
            eq(projects.domain, projectData.domain)
          )
        )
        .limit(1);

      let project = existingProjects[0] ?? null;
      let projectCreated = false;

      /* 6. Project limit check & creation */
      const activeProjectsCountResult = await tx
        .select({ count: sql<number>`count(*)` })
        .from(projects)
        .where(
          and(eq(projects.userId, userId), eq(projects.isActive, true))
        );

      const projectUsed = Number(activeProjectsCountResult[0]?.count ?? 0);

      if (!project) {
        if (projectUsed >= plan.maxProjects) {
          failureHolder.value = {
            kind: "PROJECT_LIMIT_REACHED",
            plan,
            auditUsed,
            auditLimit,
            projectUsed,
            projectLimit: plan.maxProjects,
            message: `You have reached your limit of ${plan.maxProjects} active projects.`,
          };
          throw new Error("__AUDIT_RESERVATION_ROLLBACK__");
        }

        const insertedProject = await tx
          .insert(projects)
          .values({
            userId,
            name: projectData.name,
            domain: projectData.domain,
            description: projectData.description ?? null,
            isActive: projectData.isActive ?? true,
          })
          .returning();

        project = insertedProject[0];
        projectCreated = true;
      }

      if (!project) {
        throw new Error("PROJECT_CREATION_FAILED");
      }

      /* 7. Increment audit quota atomically */
      const updatedUsage = await tx
        .update(subscriptionUsage)
        .set({
          auditsUsed: sql`${subscriptionUsage.auditsUsed} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(subscriptionUsage.id, usage.id),
            sql`${subscriptionUsage.auditsUsed} < ${auditLimit}`
          )
        )
        .returning();

      if (!updatedUsage[0]) {
        failureHolder.value = {
          kind: "AUDIT_LIMIT_REACHED",
          plan,
          auditUsed,
          auditLimit,
          projectUsed,
          projectLimit: plan.maxProjects,
          message: `You have reached your ${plan.name} audit limit.`,
        };
        throw new Error("__AUDIT_RESERVATION_ROLLBACK__");
      }

      const finalAuditUsed = updatedUsage[0].auditsUsed;
      const finalProjectsUsed = projectCreated
        ? projectUsed + 1
        : projectUsed;

      return {
        allowed: true,
        code: null,
        message: null,
        project,
        projectCreated,
        plan: {
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          currency: plan.currency,
          interval: plan.interval,
          auditLimit: plan.auditLimit,
          pagesPerAudit: plan.pagesPerAudit,
          aiRecommendationLimit: plan.aiRecommendationLimit,
          maxProjects: plan.maxProjects,
        },
        auditUsage: {
          allowed: true,
          used: finalAuditUsed,
          limit: auditLimit,
          remaining: Math.max(0, auditLimit - finalAuditUsed),
        },
        projectUsage: {
          allowed: true,
          used: finalProjectsUsed,
          limit: plan.maxProjects,
          remaining: Math.max(0, plan.maxProjects - finalProjectsUsed),
        },
      };
    });
  } catch (error: any) {
    const failureReason = failureHolder.value;

    if (
      error?.message === "__AUDIT_RESERVATION_ROLLBACK__" &&
      failureReason
    ) {
      return {
        allowed: false,
        code: failureReason.kind,
        message: failureReason.message,
        project: null,
        projectCreated: false,
        plan: failureReason.plan
          ? {
              id: failureReason.plan.id,
              name: failureReason.plan.name,
              slug: failureReason.plan.slug,
              currency: failureReason.plan.currency,
              interval: failureReason.plan.interval,
              auditLimit: failureReason.plan.auditLimit,
              pagesPerAudit: failureReason.plan.pagesPerAudit,
              aiRecommendationLimit:
                failureReason.plan.aiRecommendationLimit,
              maxProjects: failureReason.plan.maxProjects,
            }
          : null,
        auditUsage: {
          allowed: false,
          used: failureReason.auditUsed,
          limit: failureReason.auditLimit,
          remaining: Math.max(
            0,
            failureReason.auditLimit - failureReason.auditUsed
          ),
          message: failureReason.message,
        },
        projectUsage: {
          allowed: failureReason.kind !== "PROJECT_LIMIT_REACHED",
          used: failureReason.projectUsed,
          limit: failureReason.projectLimit,
          remaining: Math.max(
            0,
            failureReason.projectLimit - failureReason.projectUsed
          ),
        },
      };
    }

    throw error;
  }
}

/* =========================================================
   REFUND AUDIT RESERVATION
========================================================= */

export async function refundAuditReservation(
  userId: string,
  opts: {
    projectCreated?: boolean;
    projectId?: string;
  } = {}
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`
    );

    const now = new Date();

    const active = (
      await tx
        .select({
          subscription: subscriptions,
          plan: plans,
        })
        .from(subscriptions)
        .innerJoin(plans, eq(subscriptions.planId, plans.id))
        .where(
          and(
            eq(subscriptions.userId, userId),
            eq(subscriptions.status, "active"),
            lte(subscriptions.startsAt, now),
            gt(subscriptions.endsAt, now)
          )
        )
        .orderBy(sql`${subscriptions.endsAt} DESC`)
        .limit(1)
    )[0];

    if (!active) return;

    const usage = (
      await tx
        .select()
        .from(subscriptionUsage)
        .where(
          and(
            eq(subscriptionUsage.subscriptionId, active.subscription.id),
            eq(subscriptionUsage.periodStart, active.subscription.startsAt),
            eq(subscriptionUsage.periodEnd, active.subscription.endsAt)
          )
        )
        .limit(1)
    )[0];

    if (!usage) return;

    await tx
      .update(subscriptionUsage)
      .set({
        auditsUsed: sql`GREATEST(${subscriptionUsage.auditsUsed} - 1, 0)`,
        updatedAt: now,
      })
      .where(eq(subscriptionUsage.id, usage.id));

    if (opts.projectCreated && opts.projectId) {
      await tx
        .update(projects)
        .set({ isActive: false, updatedAt: now })
        .where(eq(projects.id, opts.projectId));
    }
  });
}

/* =========================================================
   PAGE LIMIT — PREFLIGHT
========================================================= */

export async function checkPageLimit(
  userId: string,
  requestedPages: number
): Promise<UsageResult> {
  if (!Number.isInteger(requestedPages) || requestedPages <= 0) {
    return {
      allowed: false,
      used: 0,
      limit: 0,
      remaining: 0,
      message: "Requested page count must be greater than zero.",
    };
  }

  const active = await getActiveSubscriptionWithPlan(userId);

  if (!active) {
    return {
      allowed: false,
      used: 0,
      limit: 0,
      remaining: 0,
      message: "You need an active subscription to crawl pages.",
    };
  }

  const limit = active.plan.pagesPerAudit;

  return {
    allowed: requestedPages <= limit,
    used: 0,
    limit,
    remaining: Math.max(0, limit - requestedPages),
    message:
      requestedPages > limit
        ? `Your ${active.plan.name} plan allows ${limit} pages per audit.`
        : undefined,
  };
}

/* =========================================================
   RECORD CRAWLED PAGES
========================================================= */

export async function recordPagesCrawled(
  userId: string,
  pageCount: number
): Promise<UsageResult> {
  if (!Number.isInteger(pageCount) || pageCount <= 0) {
    throw new Error("Page count must be greater than zero.");
  }

  const active = await getActiveSubscriptionWithPlan(userId);

  if (!active) {
    return {
      allowed: false,
      used: 0,
      limit: 0,
      remaining: 0,
      message: "You need an active subscription to record crawled pages.",
    };
  }

  const usage = await ensureUsagePeriod(
    userId,
    active.subscription.id,
    active.subscription.startsAt,
    active.subscription.endsAt
  );

  if (!usage) {
    throw new Error("Unable to initialize subscription usage.");
  }

  const updated = await db
    .update(subscriptionUsage)
    .set({
      pagesCrawled: sql`${subscriptionUsage.pagesCrawled} + ${pageCount}`,
      updatedAt: new Date(),
    })
    .where(eq(subscriptionUsage.id, usage.id))
    .returning();

  const used =
    updated[0]?.pagesCrawled ?? usage.pagesCrawled + pageCount;

  return {
    allowed: true,
    used,
    limit: active.plan.pagesPerAudit,
    remaining: Math.max(0, active.plan.pagesPerAudit - pageCount),
  };
}

/* =========================================================
   BACKWARD COMPATIBILITY
========================================================= */

export async function consumePages(
  userId: string,
  pageCount: number
): Promise<UsageResult> {
  return recordPagesCrawled(userId, pageCount);
}

/* =========================================================
   AI RECOMMENDATION LIMIT — PREFLIGHT
========================================================= */

export async function checkAIRecommendationLimit(
  userId: string
): Promise<UsageResult> {
  const active = await getActiveSubscriptionWithPlan(userId);

  if (!active) {
    return {
      allowed: false,
      used: 0,
      limit: 0,
      remaining: 0,
      message:
        "You need an active subscription to use AI recommendations.",
    };
  }

  const usage = await ensureUsagePeriod(
    userId,
    active.subscription.id,
    active.subscription.startsAt,
    active.subscription.endsAt
  );

  if (!usage) {
    return {
      allowed: false,
      used: 0,
      limit: active.plan.aiRecommendationLimit,
      remaining: active.plan.aiRecommendationLimit,
      message: "Unable to initialize your usage period.",
    };
  }

  const used = usage.aiRecommendationsUsed;
  const limit = active.plan.aiRecommendationLimit;

  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    message:
      used >= limit
        ? `You have reached your ${active.plan.name} AI recommendation limit.`
        : undefined,
  };
}

/* =========================================================
   CONSUME AI RECOMMENDATION — AUTHORITATIVE
========================================================= */

export async function consumeAIRecommendation(
  userId: string
): Promise<UsageResult> {
  const active = await getActiveSubscriptionWithPlan(userId);

  if (!active) {
    return {
      allowed: false,
      used: 0,
      limit: 0,
      remaining: 0,
      message:
        "You need an active subscription to use AI recommendations.",
    };
  }

  const usage = await ensureUsagePeriod(
    userId,
    active.subscription.id,
    active.subscription.startsAt,
    active.subscription.endsAt
  );

  if (!usage) {
    throw new Error("Unable to initialize subscription usage.");
  }

  const limit = active.plan.aiRecommendationLimit;

  const updated = await db
    .update(subscriptionUsage)
    .set({
      aiRecommendationsUsed: sql`${subscriptionUsage.aiRecommendationsUsed} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(subscriptionUsage.id, usage.id),
        sql`${subscriptionUsage.aiRecommendationsUsed} < ${limit}`
      )
    )
    .returning();

  if (!updated[0]) {
    const latest = await db
      .select()
      .from(subscriptionUsage)
      .where(eq(subscriptionUsage.id, usage.id))
      .limit(1);

    const used = latest[0]?.aiRecommendationsUsed ?? limit;

    return {
      allowed: false,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      message: `You have reached your ${active.plan.name} AI recommendation limit.`,
    };
  }

  const used = updated[0].aiRecommendationsUsed;

  return {
    allowed: true,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

/* =========================================================
   PROJECT LIMIT — PREFLIGHT
========================================================= */

export async function checkProjectLimit(
  userId: string
): Promise<UsageResult> {
  const active = await getActiveSubscriptionWithPlan(userId);

  if (!active) {
    return {
      allowed: false,
      used: 0,
      limit: 0,
      remaining: 0,
      message: "You need an active subscription to create projects.",
    };
  }

  const used = await getActiveProjectCount(userId);
  const limit = active.plan.maxProjects;

  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    message:
      used >= limit
        ? `You have reached your ${active.plan.name} project limit.`
        : undefined,
  };
}

/* =========================================================
   GENERIC LIMIT CHECK
========================================================= */

export async function checkUsageLimit(
  userId: string,
  type: UsageLimitType
): Promise<UsageResult> {
  switch (type) {
    case "audits":
      return checkAuditLimit(userId);

    case "ai_recommendations":
      return checkAIRecommendationLimit(userId);

    case "projects":
      return checkProjectLimit(userId);

    case "pages":
      return checkPageLimit(userId, 1);

    default:
      return {
        allowed: false,
        used: 0,
        limit: 0,
        remaining: 0,
        message: "Unknown usage limit.",
      };
  }
}