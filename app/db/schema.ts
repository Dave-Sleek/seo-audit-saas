import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  numeric,
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


       // ---------- 2FA ----------
    twoFactorSecret: text("two_factor_secret"),        // encrypted TOTP secret
    twoFactorEnabledAt: timestamp("two_factor_enabled_at", {
      withTimezone: true,
    }),
    // -------------------------------------------------

    // ----------- Email factor auth--------------------
    // inside the users table definition
      twoFactorMethod: varchar("two_factor_method", { length: 20 }),
      twoFactorEmailCodeHash: text("two_factor_email_code_hash"),
      twoFactorEmailCodeExpiresAt: timestamp("two_factor_email_code_expires_at", {
        withTimezone: true,
      }),

    emailVerifiedAt: timestamp("email_verified_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("users_role_idx").on(table.role)]
);
  
 


  /**
 * Recovery codes for 2FA.
 *
 * Codes are hashed (SHA-256) — the raw code is only shown
 * to the user once, at generation time.
 */
export const twoFactorRecoveryCodes = pgTable(
  "two_factor_recovery_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("two_factor_recovery_codes_user_id_idx").on(table.userId)]
);

/**
 * ============================================================
 * SESSIONS
 * ============================================================
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    tokenHash: text("token_hash").notNull().unique(),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
    }).notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ]
);

/**
 * ============================================================
 * PASSWORD RESET TOKENS
 * ============================================================
 */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    tokenHash: text("token_hash").notNull().unique(),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
    }).notNull(),

    usedAt: timestamp("used_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("password_reset_tokens_user_id_idx").on(table.userId),
    index("password_reset_tokens_expires_at_idx").on(table.expiresAt),
  ]
);

/**
 * ============================================================
 * PROJECTS
 * ============================================================
 */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    name: varchar("name", {
      length: 255,
    }).notNull(),

    domain: varchar("domain", {
      length: 255,
    }).notNull(),

    description: text("description"),

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("projects_user_id_idx").on(table.userId),
    index("projects_is_active_idx").on(table.isActive),
  ]
);

/**
 * ============================================================
 * AUDITS
 * ============================================================
 */
export const audits = pgTable(
  "audits",
  {
    id: uuid("id").defaultRandom().primaryKey(),

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

    sitewideScore: integer("sitewide_score"),

    pagesCrawled: integer("pages_crawled").notNull().default(0),

    pagesWithErrors: integer("pages_with_errors").notNull().default(0),

    pagesWithWarnings: integer("pages_with_warnings").notNull().default(0),

    pagesPassed: integer("pages_passed").notNull().default(0),

    duplicateTitleCount: integer("duplicate_title_count")
      .notNull()
      .default(0),

    duplicateMetaCount: integer("duplicate_meta_count").notNull().default(0),

    thinContentCount: integer("thin_content_count").notNull().default(0),

    orphanPageCount: integer("orphan_page_count").notNull().default(0),

    brokenLinkCount: integer("broken_link_count").notNull().default(0),

    canonicalConflictCount: integer("canonical_conflict_count")
      .notNull()
      .default(0),

    redirectChainCount: integer("redirect_chain_count").notNull().default(0),

    categoryScores: jsonb("category_scores")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),

    aiRecommendations: jsonb("ai_recommendations")
      .$type<{
        summary: string;

        recommendations: {
          title: string;
          priority: "high" | "medium" | "low";
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

    aiGeneratedAt: timestamp("ai_generated_at", {
      withTimezone: true,
    }),

    aiModel: varchar("ai_model", {
      length: 100,
    }),

    errorMessage: text("error_message"),

    startedAt: timestamp("started_at", {
      withTimezone: true,
    }),

    completedAt: timestamp("completed_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audits_project_id_idx").on(table.projectId),
    index("audits_status_idx").on(table.status),
    index("audits_created_at_idx").on(table.createdAt),
  ]
);

/**
 * ============================================================
 * AUDIT PAGES
 * ============================================================
 */
export const auditPages = pgTable(
  "audit_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    auditId: uuid("audit_id")
      .notNull()
      .references(() => audits.id, {
        onDelete: "cascade",
      }),

    url: text("url").notNull(),

    finalUrl: text("final_url"),

    statusCode: integer("status_code"),

    contentType: varchar("content_type", {
      length: 100,
    }),

    redirectCount: integer("redirect_count").notNull().default(0),

    redirectChain: jsonb("redirect_chain")
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

    titleLength: integer("title_length"),

    metaDescription: text("meta_description"),

    metaDescriptionLength: integer("meta_description_length"),

    canonicalUrl: text("canonical_url"),

    robotsMeta: text("robots_meta"),

    h1: text("h1"),

    h1Count: integer("h1_count"),

    h2Count: integer("h2_count"),

    wordCount: integer("word_count"),

    internalLinksCount: integer("internal_links_count"),

    externalLinksCount: integer("external_links_count"),

    imagesCount: integer("images_count"),

    imagesWithoutAlt: integer("images_without_alt"),

    hasHttps: boolean("has_https"),

    hasSchema: boolean("has_schema"),

    hasOpenGraph: boolean("has_open_graph"),

    hasTwitterCard: boolean("has_twitter_card"),

    isIndexable: boolean("is_indexable"),

    pageScore: integer("page_score"),

    responseTimeMs: integer("response_time_ms"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_pages_audit_id_idx").on(table.auditId),
    index("audit_pages_status_code_idx").on(table.statusCode),
    index("audit_pages_is_indexable_idx").on(table.isIndexable),
  ]
);

/**
 * ============================================================
 * AUDIT LINKS
 * ============================================================
 */
export const auditLinks = pgTable(
  "audit_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),

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

    sourceUrl: text("source_url").notNull(),

    targetUrl: text("target_url").notNull(),

    normalizedTargetUrl: text("normalized_target_url").notNull(),

    anchorText: text("anchor_text"),

    isInternal: boolean("is_internal").notNull().default(true),

    targetStatusCode: integer("target_status_code"),

    targetPageId: uuid("target_page_id").references(() => auditPages.id, {
      onDelete: "set null",
    }),

    isBroken: boolean("is_broken").notNull().default(false),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_links_audit_id_idx").on(table.auditId),
    index("audit_links_source_page_id_idx").on(table.sourcePageId),
    index("audit_links_target_page_id_idx").on(table.targetPageId),
    index("audit_links_is_broken_idx").on(table.isBroken),
    index("audit_links_normalized_target_url_idx").on(
      table.normalizedTargetUrl
    ),
  ]
);

/**
 * ============================================================
 * AUDIT ISSUES
 * ============================================================
 */
export const auditIssues = pgTable(
  "audit_issues",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    auditId: uuid("audit_id")
      .notNull()
      .references(() => audits.id, {
        onDelete: "cascade",
      }),

    pageId: uuid("page_id").references(() => auditPages.id, {
      onDelete: "cascade",
    }),

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

    description: text("description"),

    recommendation: text("recommendation"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_issues_audit_id_idx").on(table.auditId),
    index("audit_issues_page_id_idx").on(table.pageId),
    index("audit_issues_severity_idx").on(table.severity),
    index("audit_issues_category_idx").on(table.category),
  ]
);

/**
 * ============================================================
 * PLANS
 * ============================================================
 */
export const plans = pgTable(
  "plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    name: varchar("name", {
      length: 100,
    }).notNull(),

    slug: varchar("slug", {
      length: 100,
    })
      .notNull()
      .unique(),

    description: text("description"),

    /**
     * Amount in the smallest currency unit (kobo for NGN).
     * Example: ₦5,000 = 500000
     */
    price: integer("price").notNull().default(0),

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

    auditLimit: integer("audit_limit").notNull().default(3),

    pagesPerAudit: integer("pages_per_audit").notNull().default(20),

    aiRecommendationLimit: integer("ai_recommendation_limit")
      .notNull()
      .default(0),

    maxProjects: integer("max_projects").notNull().default(1),

    isActive: boolean("is_active").notNull().default(true),

    isFeatured: boolean("is_featured").notNull().default(false),

    paystackPlanCode: varchar("paystack_plan_code", {
      length: 100,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("plans_is_active_idx").on(table.isActive),
    index("plans_is_featured_idx").on(table.isFeatured),
    index("plans_interval_idx").on(table.interval),
  ]
);

/**
 * ============================================================
 * SUBSCRIPTIONS
 * ============================================================
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

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

      pendingPlanId: uuid("pending_plan_id").references(() => plans.id, {
        onDelete: "set null",
      }),
      pendingChangeAt: timestamp("pending_change_at", { withTimezone: true }),

    status: varchar("status", {
      length: 50,
    })
      .notNull()
      .default("active"),

    paystackCustomerCode: varchar("paystack_customer_code", {
      length: 100,
    }),

    paystackSubscriptionCode: varchar("paystack_subscription_code", {
      length: 100,
    }),

    paystackEmailToken: text("paystack_email_token"),

    startsAt: timestamp("starts_at", {
      withTimezone: true,
    }).notNull(),

    endsAt: timestamp("ends_at", {
      withTimezone: true,
    }).notNull(),

    cancelledAt: timestamp("cancelled_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("subscriptions_user_id_idx").on(table.userId),
    index("subscriptions_plan_id_idx").on(table.planId),
    index("subscriptions_status_idx").on(table.status),
    index("subscriptions_ends_at_idx").on(table.endsAt),

    uniqueIndex("subscriptions_paystack_subscription_code_idx").on(
      table.paystackSubscriptionCode
    ),

    index("subscriptions_user_status_idx").on(table.userId, table.status),
  ]
);

/**
 * ============================================================
 * PAYMENTS
 * ============================================================
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    subscriptionId: uuid("subscription_id").references(
      () => subscriptions.id,
      {
        onDelete: "set null",
      }
    ),

    provider: varchar("provider", {
      length: 50,
    })
      .notNull()
      .default("paystack"),

    reference: varchar("reference", {
      length: 255,
    })
      .notNull()
      .unique(),

    providerTransactionId: varchar("provider_transaction_id", {
      length: 255,
    }),

    /**
     * Amount in the smallest currency unit.
     * Column type is numeric(12, 2).
     */
    amount: numeric("amount", {
      precision: 12,
      scale: 2,
    }).notNull(),

    currency: varchar("currency", {
      length: 10,
    })
      .notNull()
      .default("NGN"),

    /**
     * Expected values:
     * pending | successful | failed | refunded
     */
    status: varchar("status", {
      length: 50,
    })
      .notNull()
      .default("pending"),

    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({}),

    paidAt: timestamp("paid_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("payments_user_id_idx").on(table.userId),
    index("payments_subscription_id_idx").on(table.subscriptionId),
    index("idx_payments_status").on(table.status),

    uniqueIndex("payments_reference_key").on(table.reference),
  ]
);

/**
 * ============================================================
 * SUBSCRIPTION USAGE
 * ============================================================
 */
export const subscriptionUsage = pgTable(
  "subscription_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id, {
        onDelete: "cascade",
      }),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    periodStart: timestamp("period_start", {
      withTimezone: true,
    }).notNull(),

    periodEnd: timestamp("period_end", {
      withTimezone: true,
    }).notNull(),

    renewalReference: varchar("renewal_reference", {
      length: 255,
    }),

    auditsUsed: integer("audits_used").notNull().default(0),

    pagesCrawled: integer("pages_crawled").notNull().default(0),

    aiRecommendationsUsed: integer("ai_recommendations_used")
      .notNull()
      .default(0),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("subscription_usage_subscription_id_idx").on(table.subscriptionId),
    index("subscription_usage_user_id_idx").on(table.userId),

    index("subscription_usage_period_idx").on(
      table.periodStart,
      table.periodEnd
    ),

    uniqueIndex("subscription_usage_period_unique_idx").on(
      table.subscriptionId,
      table.periodStart,
      table.periodEnd
    ),

    uniqueIndex("subscription_usage_renewal_reference_idx")
      .on(table.renewalReference)
      .where(sql`${table.renewalReference} IS NOT NULL`),
  ]
);

// Notification

// app/db/schema.ts
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    type: varchar("type", { length: 60 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    actionUrl: varchar("action_url", { length: 500 }),

    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("notifications_user_id_created_at_idx").on(
      table.userId,
      table.createdAt
    ),
    index("notifications_user_id_read_at_idx")
      .on(table.userId, table.readAt)
      .where(sql`${table.readAt} IS NULL`),
  ]
);


export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    tokenHash: text("token_hash").notNull().unique(),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
    }).notNull(),

    usedAt: timestamp("used_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("email_verification_tokens_user_id_idx").on(
      table.userId
    ),
    index("email_verification_tokens_expires_at_idx").on(
      table.expiresAt
    ),
  ]
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /*
     * No FK constraints on these. The audit log is a
     * historical record — it must survive user deletions.
     * Store the UUID as a plain column.
     */
    userId: uuid("user_id"),
    actorId: uuid("actor_id"),

    eventType: varchar("event_type", { length: 60 }).notNull(),
    severity: varchar("severity", { length: 20 })
      .notNull()
      .default("info"),

    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),

    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_log_user_id_created_at_idx").on(
      table.userId,
      table.createdAt
    ),
    index("audit_log_actor_id_created_at_idx").on(
      table.actorId,
      table.createdAt
    ),
    index("audit_log_event_type_created_at_idx").on(
      table.eventType,
      table.createdAt
    ),
  ]
);


// app/db/schema.ts — add these tables

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /*
     * Short human-readable reference ("TKT-7F3A"). Unique across
     * the table so it can be quoted in emails or support chats.
     */
    reference: varchar("reference", { length: 20 })
      .notNull()
      .unique(),

    subject: varchar("subject", { length: 200 }).notNull(),

    /*
     * Constrained to a known set by the form, but stored as
     * varchar so we can add categories without a migration.
     */
    category: varchar("category", { length: 50 })
      .notNull()
      .default("other"),

    status: varchar("status", { length: 30 })
      .notNull()
      .default("open"),

    priority: varchar("priority", { length: 20 })
      .notNull()
      .default("normal"),

    body: text("body").notNull(),

    lastReplyAt: timestamp("last_reply_at", {
      withTimezone: true,
    }),

    resolvedAt: timestamp("resolved_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("support_tickets_user_id_idx").on(table.userId),
    index("support_tickets_status_idx").on(table.status),
    index("support_tickets_created_at_idx").on(table.createdAt),
  ]
);

export const supportTicketReplies = pgTable(
  "support_ticket_replies",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, {
        onDelete: "cascade",
      }),

    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /*
     * "user" or "admin". Determines display treatment and whether
     * the reply counts as an official response.
     */
    authorRole: varchar("author_role", { length: 20 })
      .notNull()
      .default("user"),

    body: text("body").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("support_ticket_replies_ticket_id_idx").on(table.ticketId),
  ]
);

/* =========================================================
   PROJECT COLLABORATORS
========================================================= */

export const projectCollaborators = pgTable(
  "project_collaborators",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    /**
     * Set once the invitee has an account and accepts.
     * Null while the invitation is pending.
     */
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),

    invitedEmail: varchar("invited_email", { length: 320 }).notNull(),

    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    token: varchar("token", { length: 64 }).notNull().unique(),

    status: varchar("status", { length: 20 })
      .notNull()
      .default("pending"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (table) => ({
    projectEmailUnique: uniqueIndex(
      "project_collaborators_project_email_unique"
    ).on(table.projectId, table.invitedEmail),

    projectIdx: index("project_collaborators_project_id_idx").on(
      table.projectId
    ),

    userIdx: index("project_collaborators_user_id_idx").on(
      table.userId
    ),
  })
);

export type ProjectCollaborator =
  typeof projectCollaborators.$inferSelect;