import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * ============================================================
 * USERS
 * ============================================================
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    name: varchar("name", {
      length: 120,
    }).notNull(),

    email: varchar("email", {
      length: 255,
    })
      .notNull()
      .unique(),

    passwordHash: text("password_hash").notNull(),

    role: varchar("role", {
      length: 30,
    })
      .notNull()
      .default("user"),

    emailVerifiedAt: timestamp(
      "email_verified_at",
      { withTimezone: true }
    ),

    createdAt: timestamp(
      "created_at",
      { withTimezone: true }
    )
      .defaultNow()
      .notNull(),

    updatedAt: timestamp(
      "updated_at",
      { withTimezone: true }
    )
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    roleIdx: index("users_role_idx").on(
      table.role
    ),
  })
);

/**
 * ============================================================
 * SESSIONS
 * ============================================================
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    tokenHash: text("token_hash")
      .notNull()
      .unique(),

    expiresAt: timestamp(
      "expires_at",
      { withTimezone: true }
    ).notNull(),

    createdAt: timestamp(
      "created_at",
      { withTimezone: true }
    )
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdx: index("sessions_user_id_idx").on(
      table.userId
    ),

    expiresIdx: index(
      "sessions_expires_at_idx"
    ).on(table.expiresAt),
  })
);

/**
 * ============================================================
 * PASSWORD RESET TOKENS
 * ============================================================
 */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    tokenHash: text("token_hash")
      .notNull()
      .unique(),

    expiresAt: timestamp(
      "expires_at",
      { withTimezone: true }
    ).notNull(),

    usedAt: timestamp(
      "used_at",
      { withTimezone: true }
    ),

    createdAt: timestamp(
      "created_at",
      { withTimezone: true }
    )
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdx: index(
      "password_reset_tokens_user_id_idx"
    ).on(table.userId),

    expiresIdx: index(
      "password_reset_tokens_expires_at_idx"
    ).on(table.expiresAt),
  })
);

/**
 * ============================================================
 * PROJECTS
 * ============================================================
 */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    userId: uuid("user_id").references(
      () => users.id,
      {
        onDelete: "set null",
      }
    ),

    name: varchar("name", {
      length: 255,
    }).notNull(),

    domain: varchar("domain", {
      length: 255,
    }).notNull(),

    description: text("description"),

    isActive: boolean("is_active")
      .notNull()
      .default(true),

    createdAt: timestamp(
      "created_at",
      { withTimezone: true }
    )
      .defaultNow()
      .notNull(),

    updatedAt: timestamp(
      "updated_at",
      { withTimezone: true }
    )
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdx: index("projects_user_id_idx").on(
      table.userId
    ),

    activeIdx: index(
      "projects_is_active_idx"
    ).on(table.isActive),
  })
);

/**
 * ============================================================
 * AUDITS
 * ============================================================
 */
export const audits = pgTable(
  "audits",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, {
        onDelete: "cascade",
      }),

    url: text("url").notNull(),

    status: varchar("status", {
      length: 50,
    }).notNull(),

    score: integer("score"),

    sitewideScore: integer(
      "sitewide_score"
    ),

    pagesCrawled: integer(
      "pages_crawled"
    )
      .notNull()
      .default(0),

    pagesWithErrors: integer(
      "pages_with_errors"
    )
      .notNull()
      .default(0),

    pagesWithWarnings: integer(
      "pages_with_warnings"
    )
      .notNull()
      .default(0),

    pagesPassed: integer(
      "pages_passed"
    )
      .notNull()
      .default(0),

    /**
     * Phase 7 - Sitewide SEO Intelligence
     */
    duplicateTitleCount: integer(
      "duplicate_title_count"
    )
      .notNull()
      .default(0),

    duplicateMetaCount: integer(
      "duplicate_meta_count"
    )
      .notNull()
      .default(0),

    thinContentCount: integer(
      "thin_content_count"
    )
      .notNull()
      .default(0),

    orphanPageCount: integer(
      "orphan_page_count"
    )
      .notNull()
      .default(0),

    brokenLinkCount: integer(
      "broken_link_count"
    )
      .notNull()
      .default(0),

    canonicalConflictCount: integer(
      "canonical_conflict_count"
    )
      .notNull()
      .default(0),

    redirectChainCount: integer(
      "redirect_chain_count"
    )
      .notNull()
      .default(0),

    categoryScores: jsonb(
      "category_scores"
    )
      .$type<Record<string, number>>()
      .notNull()
      .default({}),

    /**
     * Phase 8 - AI SEO Recommendations
     */
    aiRecommendations: jsonb(
      "ai_recommendations"
    )
      .$type<{
        summary: string;

        recommendations: {
          title: string;
          priority:
            | "high"
            | "medium"
            | "low";
          category: string;
          problem: string;
          whyItMatters: string;
          recommendation: string;
          actionSteps: string[];
          affectedPages: string[];
        }[];

        quickWins: string[];

        technicalNotes: string[];
      } | null>()
      .default(null),

    aiGeneratedAt: timestamp(
      "ai_generated_at",
      { withTimezone: true }
    ),

    aiModel: varchar("ai_model", {
      length: 100,
    }),

    errorMessage: text(
      "error_message"
    ),

    startedAt: timestamp(
      "started_at",
      { withTimezone: true }
    ),

    completedAt: timestamp(
      "completed_at",
      { withTimezone: true }
    ),

    createdAt: timestamp(
      "created_at",
      { withTimezone: true }
    )
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    projectIdx: index(
      "audits_project_id_idx"
    ).on(table.projectId),

    statusIdx: index(
      "audits_status_idx"
    ).on(table.status),

    createdIdx: index(
      "audits_created_at_idx"
    ).on(table.createdAt),
  })
);

/**
 * ============================================================
 * AUDIT PAGES
 * ============================================================
 */
export const auditPages = pgTable(
  "audit_pages",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    auditId: uuid("audit_id")
      .notNull()
      .references(() => audits.id, {
        onDelete: "cascade",
      }),

    /**
     * Original URL requested/discovered
     * by the crawler.
     */
    url: text("url").notNull(),

    /**
     * Final URL after redirects.
     */
    finalUrl: text("final_url"),

    /**
     * Final HTTP response status.
     */
    statusCode: integer("status_code"),

    contentType: varchar("content_type", {
      length: 100,
    }),

    /**
     * Number of redirects before reaching
     * finalUrl.
     */
    redirectCount: integer(
      "redirect_count"
    )
      .notNull()
      .default(0),

    /**
     * Complete redirect chain.
     */
    redirectChain: jsonb(
      "redirect_chain"
    )
      .$type<
        {
          url: string;
          statusCode: number;
          responseTimeMs: number;
        }[]
      >()
      .notNull()
      .default([]),

    title: text("title"),

    titleLength: integer(
      "title_length"
    ),

    metaDescription: text(
      "meta_description"
    ),

    metaDescriptionLength: integer(
      "meta_description_length"
    ),

    canonicalUrl: text(
      "canonical_url"
    ),

    robotsMeta: text(
      "robots_meta"
    ),

    h1: text("h1"),

    h1Count: integer("h1_count"),

    h2Count: integer("h2_count"),

    wordCount: integer("word_count"),

    internalLinksCount: integer(
      "internal_links_count"
    ),

    externalLinksCount: integer(
      "external_links_count"
    ),

    imagesCount: integer(
      "images_count"
    ),

    imagesWithoutAlt: integer(
      "images_without_alt"
    ),

    hasHttps: boolean("has_https"),

    hasSchema: boolean("has_schema"),

    hasOpenGraph: boolean(
      "has_open_graph"
    ),

    hasTwitterCard: boolean(
      "has_twitter_card"
    ),

    isIndexable: boolean(
      "is_indexable"
    ),

    pageScore: integer(
      "page_score"
    ),

    responseTimeMs: integer(
      "response_time_ms"
    ),

    createdAt: timestamp(
      "created_at",
      { withTimezone: true }
    )
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    auditIdx: index(
      "audit_pages_audit_id_idx"
    ).on(table.auditId),

    statusIdx: index(
      "audit_pages_status_code_idx"
    ).on(table.statusCode),

    indexableIdx: index(
      "audit_pages_is_indexable_idx"
    ).on(table.isIndexable),
  })
);

/**
 * ============================================================
 * AUDIT LINKS
 * ============================================================
 */
export const auditLinks = pgTable(
  "audit_links",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    auditId: uuid("audit_id")
      .notNull()
      .references(() => audits.id, {
        onDelete: "cascade",
      }),

    sourcePageId: uuid("source_page_id")
      .notNull()
      .references(() => auditPages.id, {
        onDelete: "cascade",
      }),

    sourceUrl: text(
      "source_url"
    ).notNull(),

    targetUrl: text(
      "target_url"
    ).notNull(),

    normalizedTargetUrl: text(
      "normalized_target_url"
    ).notNull(),

    anchorText: text(
      "anchor_text"
    ),

    isInternal: boolean(
      "is_internal"
    )
      .notNull()
      .default(true),

    targetStatusCode: integer(
      "target_status_code"
    ),

    targetPageId: uuid(
      "target_page_id"
    ).references(
      () => auditPages.id,
      {
        onDelete: "set null",
      }
    ),

    isBroken: boolean(
      "is_broken"
    )
      .notNull()
      .default(false),

    createdAt: timestamp(
      "created_at",
      { withTimezone: true }
    )
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    auditIdx: index(
      "audit_links_audit_id_idx"
    ).on(table.auditId),

    sourcePageIdx: index(
      "audit_links_source_page_id_idx"
    ).on(table.sourcePageId),

    targetPageIdx: index(
      "audit_links_target_page_id_idx"
    ).on(table.targetPageId),

    brokenIdx: index(
      "audit_links_is_broken_idx"
    ).on(table.isBroken),

    normalizedTargetIdx: index(
      "audit_links_normalized_target_url_idx"
    ).on(table.normalizedTargetUrl),
  })
);

/**
 * ============================================================
 * AUDIT ISSUES
 * ============================================================
 */
export const auditIssues = pgTable(
  "audit_issues",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    auditId: uuid("audit_id")
      .notNull()
      .references(() => audits.id, {
        onDelete: "cascade",
      }),

    pageId: uuid("page_id").references(
      () => auditPages.id,
      {
        onDelete: "cascade",
      }
    ),

    category: varchar("category", {
      length: 100,
    }).notNull(),

    type: varchar("type", {
      length: 100,
    }).notNull(),

    severity: varchar("severity", {
      length: 50,
    }).notNull(),

    title: varchar("title", {
      length: 255,
    }).notNull(),

    description: text(
      "description"
    ),

    recommendation: text(
      "recommendation"
    ),

    createdAt: timestamp(
      "created_at",
      { withTimezone: true }
    )
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    auditIdx: index(
      "audit_issues_audit_id_idx"
    ).on(table.auditId),

    pageIdx: index(
      "audit_issues_page_id_idx"
    ).on(table.pageId),

    severityIdx: index(
      "audit_issues_severity_idx"
    ).on(table.severity),

    categoryIdx: index(
      "audit_issues_category_idx"
    ).on(table.category),
  })
);

/**
 * ============================================================
 * PLANS
 * ============================================================
 */
export const plans = pgTable(
  "plans",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    name: varchar("name", {
      length: 100,
    }).notNull(),

    slug: varchar("slug", {
      length: 100,
    })
      .notNull()
      .unique(),

    description: text(
      "description"
    ),

    /**
     * Amount in the smallest currency
     * unit used by Paystack.
     *
     * Example:
     * ₦5,000 = 500000 kobo
     */
    price: integer("price")
      .notNull()
      .default(0),

    currency: varchar("currency", {
      length: 10,
    })
      .notNull()
      .default("NGN"),

    interval: varchar("interval", {
      length: 30,
    })
      .notNull()
      .default("monthly"),

    /**
     * Number of audits allowed
     * during the subscription period.
     */
    auditLimit: integer(
      "audit_limit"
    )
      .notNull()
      .default(3),

    /**
     * Maximum pages allowed per audit.
     */
    pagesPerAudit: integer(
      "pages_per_audit"
    )
      .notNull()
      .default(20),

    /**
     * Number of AI recommendation
     * generations allowed.
     */
    aiRecommendationLimit: integer(
      "ai_recommendation_limit"
    )
      .notNull()
      .default(0),

    /**
     * Maximum projects allowed.
     */
    maxProjects: integer(
      "max_projects"
    )
      .notNull()
      .default(1),

    isActive: boolean("is_active")
      .notNull()
      .default(true),

    isFeatured: boolean(
      "is_featured"
    )
      .notNull()
      .default(false),

    /**
     * Paystack recurring plan code.
     *
     * Required for paid recurring
     * subscriptions.
     */
    paystackPlanCode: varchar(
      "paystack_plan_code",
      {
        length: 100,
      }
    ),

    createdAt: timestamp(
      "created_at",
      { withTimezone: true }
    )
      .defaultNow()
      .notNull(),

    updatedAt: timestamp(
      "updated_at",
      { withTimezone: true }
    )
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    activeIdx: index(
      "plans_is_active_idx"
    ).on(table.isActive),

    featuredIdx: index(
      "plans_is_featured_idx"
    ).on(table.isFeatured),

    intervalIdx: index(
      "plans_interval_idx"
    ).on(table.interval),
  })
);

/**
 * ============================================================
 * SUBSCRIPTIONS
 * ============================================================
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, {
        onDelete: "restrict",
      }),

    /**
     * Expected values:
     *
     * active
     * cancelled
     * expired
     * past_due
     * non_renewing
     */
    status: varchar("status", {
      length: 50,
    })
      .notNull()
      .default("active"),

    paystackCustomerCode: varchar(
      "paystack_customer_code",
      {
        length: 100,
      }
    ),

    /**
     * Paystack recurring subscription
     * code.
     */
    paystackSubscriptionCode: varchar(
      "paystack_subscription_code",
      {
        length: 100,
      }
    ),

    /**
     * Paystack email token used for
     * subscription management actions.
     */
    paystackEmailToken: text(
      "paystack_email_token"
    ),

    startsAt: timestamp(
      "starts_at",
      { withTimezone: true }
    ).notNull(),

    endsAt: timestamp(
      "ends_at",
      { withTimezone: true }
    ).notNull(),

    cancelledAt: timestamp(
      "cancelled_at",
      { withTimezone: true }
    ),

    createdAt: timestamp(
      "created_at",
      { withTimezone: true }
    )
      .defaultNow()
      .notNull(),

    updatedAt: timestamp(
      "updated_at",
      { withTimezone: true }
    )
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdx: index(
      "subscriptions_user_id_idx"
    ).on(table.userId),

    planIdx: index(
      "subscriptions_plan_id_idx"
    ).on(table.planId),

    statusIdx: index(
      "subscriptions_status_idx"
    ).on(table.status),

    endsAtIdx: index(
      "subscriptions_ends_at_idx"
    ).on(table.endsAt),

    paystackSubscriptionIdx: uniqueIndex(
      "subscriptions_paystack_subscription_code_idx"
    ).on(
      table.paystackSubscriptionCode
    ),

    userStatusIdx: index(
      "subscriptions_user_status_idx"
    ).on(
      table.userId,
      table.status
    ),
  })
);

/**
 * ============================================================
 * PAYMENTS
 * ============================================================
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    planId: uuid("plan_id").references(
      () => plans.id,
      {
        onDelete: "set null",
      }
    ),

    subscriptionId: uuid(
      "subscription_id"
    ).references(
      () => subscriptions.id,
      {
        onDelete: "set null",
      }
    ),

    /**
     * Internal unique payment reference.
     *
     * Example:
     * SUB_a8f2c...
     */
    reference: varchar("reference", {
      length: 100,
    })
      .notNull()
      .unique(),

    /**
     * Amount stored in the smallest
     * currency unit.
     *
     * NGN:
     * ₦5,000 = 500000
     */
    amount: integer("amount")
      .notNull(),

    currency: varchar("currency", {
      length: 10,
    })
      .notNull()
      .default("NGN"),

    /**
     * Expected values:
     *
     * pending
     * success
     * failed
     */
    status: varchar("status", {
      length: 50,
    })
      .notNull()
      .default("pending"),

    paymentType: varchar(
      "payment_type",
      {
        length: 50,
      }
    )
      .notNull()
      .default("subscription"),

    paystackTransactionId: varchar(
      "paystack_transaction_id",
      {
        length: 100,
      }
    ),

    paystackCustomerCode: varchar(
      "paystack_customer_code",
      {
        length: 100,
      }
    ),

    authorizationCode: text(
      "authorization_code"
    ),

    metadata: jsonb("metadata")
      .$type<
        Record<string, unknown>
      >()
      .default({}),

    paidAt: timestamp(
      "paid_at",
      { withTimezone: true }
    ),

    createdAt: timestamp(
      "created_at",
      { withTimezone: true }
    )
      .defaultNow()
      .notNull(),

    updatedAt: timestamp(
      "updated_at",
      { withTimezone: true }
    )
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdx: index(
      "payments_user_id_idx"
    ).on(table.userId),

    planIdx: index(
      "payments_plan_id_idx"
    ).on(table.planId),

    subscriptionIdx: index(
      "payments_subscription_id_idx"
    ).on(table.subscriptionId),

    statusIdx: index(
      "payments_status_idx"
    ).on(table.status),

    createdIdx: index(
      "payments_created_at_idx"
    ).on(table.createdAt),

    transactionIdx: uniqueIndex(
      "payments_paystack_transaction_id_idx"
    ).on(
      table.paystackTransactionId
    ),
  })
);

/**
 * ============================================================
 * SUBSCRIPTION USAGE
 * ============================================================
 */
export const subscriptionUsage =
  pgTable(
    "subscription_usage",
    {
      id: uuid("id")
        .defaultRandom()
        .primaryKey(),

      subscriptionId: uuid(
        "subscription_id"
      )
        .notNull()
        .references(
          () => subscriptions.id,
          {
            onDelete: "cascade",
          }
        ),

      userId: uuid("user_id")
        .notNull()
        .references(
          () => users.id,
          {
            onDelete: "cascade",
          }
        ),

      /**
       * Start of the billing/usage period.
       */
      periodStart: timestamp(
        "period_start",
        { withTimezone: true }
      ).notNull(),

      /**
       * End of the billing/usage period.
       */
      periodEnd: timestamp(
        "period_end",
        { withTimezone: true }
      ).notNull(),

      auditsUsed: integer(
        "audits_used"
      )
        .notNull()
        .default(0),

      pagesCrawled: integer(
        "pages_crawled"
      )
        .notNull()
        .default(0),

      aiRecommendationsUsed: integer(
        "ai_recommendations_used"
      )
        .notNull()
        .default(0),

      createdAt: timestamp(
        "created_at",
        { withTimezone: true }
      )
        .defaultNow()
        .notNull(),

      updatedAt: timestamp(
        "updated_at",
        { withTimezone: true }
      )
        .defaultNow()
        .notNull(),
    },
    (table) => ({
      subscriptionIdx: index(
        "subscription_usage_subscription_id_idx"
      ).on(table.subscriptionId),

      userIdx: index(
        "subscription_usage_user_id_idx"
      ).on(table.userId),

      periodIdx: index(
        "subscription_usage_period_idx"
      ).on(
        table.periodStart,
        table.periodEnd
      ),

      /**
       * A subscription/user should only
       * have one usage record for a
       * particular billing period.
       */
      periodUniqueIdx: uniqueIndex(
        "subscription_usage_period_unique_idx"
      ).on(
        table.subscriptionId,
        table.periodStart,
        table.periodEnd
      ),
    })
  );