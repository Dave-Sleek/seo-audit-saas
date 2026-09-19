-- ============================================================
-- SEO AUDIT SAAS - NEON POSTGRESQL DATABASE
-- ============================================================

-- UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(255),

    email VARCHAR(255) NOT NULL UNIQUE,

    password_hash TEXT,

    avatar_url TEXT,

    role VARCHAR(50) NOT NULL DEFAULT 'user'
        CHECK (role IN ('user', 'admin')),

    email_verified_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);


-- ============================================================
-- PROJECTS
-- A user can have multiple SEO projects/websites
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    name VARCHAR(255) NOT NULL,

    domain VARCHAR(255) NOT NULL,

    description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_projects_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


-- ============================================================
-- AUDITS
-- One audit represents one complete website scan
-- ============================================================

CREATE TABLE IF NOT EXISTS audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id UUID NOT NULL,

    url TEXT NOT NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'running',
                'completed',
                'failed'
            )
        ),

    score INTEGER
        CHECK (score >= 0 AND score <= 100),

    pages_crawled INTEGER NOT NULL DEFAULT 0,

    pages_with_errors INTEGER NOT NULL DEFAULT 0,

    pages_with_warnings INTEGER NOT NULL DEFAULT 0,

    pages_passed INTEGER NOT NULL DEFAULT 0,

    error_message TEXT,

    started_at TIMESTAMP WITH TIME ZONE,

    completed_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_audits_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE
);


-- ============================================================
-- AUDIT PAGES
-- Individual pages discovered during a website crawl
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    audit_id UUID NOT NULL,

    url TEXT NOT NULL,

    status_code INTEGER,

    content_type VARCHAR(100),

    title TEXT,

    title_length INTEGER,

    meta_description TEXT,

    meta_description_length INTEGER,

    canonical_url TEXT,

    robots_meta TEXT,

    h1 TEXT,

    h1_count INTEGER NOT NULL DEFAULT 0,

    h2_count INTEGER NOT NULL DEFAULT 0,

    word_count INTEGER NOT NULL DEFAULT 0,

    internal_links_count INTEGER NOT NULL DEFAULT 0,

    external_links_count INTEGER NOT NULL DEFAULT 0,

    images_count INTEGER NOT NULL DEFAULT 0,

    images_without_alt INTEGER NOT NULL DEFAULT 0,

    has_https BOOLEAN NOT NULL DEFAULT FALSE,

    has_schema BOOLEAN NOT NULL DEFAULT FALSE,

    has_open_graph BOOLEAN NOT NULL DEFAULT FALSE,

    has_twitter_card BOOLEAN NOT NULL DEFAULT FALSE,

    is_indexable BOOLEAN,

    page_score INTEGER
        CHECK (page_score >= 0 AND page_score <= 100),

    response_time_ms INTEGER,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_audit_pages_audit
        FOREIGN KEY (audit_id)
        REFERENCES audits(id)
        ON DELETE CASCADE
);


-- ============================================================
-- AUDIT ISSUES
-- Problems discovered during an audit
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    audit_id UUID NOT NULL,

    page_id UUID,

    category VARCHAR(100) NOT NULL,

    type VARCHAR(100) NOT NULL,

    severity VARCHAR(50) NOT NULL
        CHECK (
            severity IN (
                'critical',
                'error',
                'warning',
                'notice'
            )
        ),

    title VARCHAR(255) NOT NULL,

    description TEXT,

    recommendation TEXT,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_audit_issues_audit
        FOREIGN KEY (audit_id)
        REFERENCES audits(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_audit_issues_page
        FOREIGN KEY (page_id)
        REFERENCES audit_pages(id)
        ON DELETE CASCADE
);


-- ============================================================
-- KEYWORDS
-- Keywords tracked for a project
-- ============================================================

CREATE TABLE IF NOT EXISTS keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id UUID NOT NULL,

    keyword VARCHAR(500) NOT NULL,

    country VARCHAR(100),

    language VARCHAR(50),

    device VARCHAR(50)
        CHECK (
            device IS NULL OR
            device IN ('desktop', 'mobile', 'tablet')
        ),

    target_url TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_keywords_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE
);


-- ============================================================
-- KEYWORD RANKINGS
-- Historical keyword ranking data
-- ============================================================

CREATE TABLE IF NOT EXISTS keyword_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    keyword_id UUID NOT NULL,

    position INTEGER,

    previous_position INTEGER,

    search_volume INTEGER,

    url TEXT,

    checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_keyword_rankings_keyword
        FOREIGN KEY (keyword_id)
        REFERENCES keywords(id)
        ON DELETE CASCADE
);


-- ============================================================
-- SUBSCRIPTION PLANS
-- ============================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL UNIQUE,

    slug VARCHAR(100) NOT NULL UNIQUE,

    description TEXT,

    price_monthly NUMERIC(12, 2) NOT NULL DEFAULT 0,

    price_yearly NUMERIC(12, 2) NOT NULL DEFAULT 0,

    max_projects INTEGER,

    max_audits_per_month INTEGER,

    max_pages_per_audit INTEGER,

    max_keywords INTEGER,

    features JSONB,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);


-- ============================================================
-- USER SUBSCRIPTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    plan_id UUID NOT NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'active'
        CHECK (
            status IN (
                'trialing',
                'active',
                'past_due',
                'cancelled',
                'expired'
            )
        ),

    provider VARCHAR(50),

    provider_subscription_id VARCHAR(255),

    starts_at TIMESTAMP WITH TIME ZONE,

    ends_at TIMESTAMP WITH TIME ZONE,

    cancelled_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_user_subscriptions_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_subscriptions_plan
        FOREIGN KEY (plan_id)
        REFERENCES subscription_plans(id)
        ON DELETE RESTRICT
);


-- ============================================================
-- PAYMENTS
-- Paystack/Stripe/etc.
-- ============================================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    subscription_id UUID,

    provider VARCHAR(50) NOT NULL,

    reference VARCHAR(255) NOT NULL UNIQUE,

    provider_transaction_id VARCHAR(255),

    amount NUMERIC(12, 2) NOT NULL,

    currency VARCHAR(10) NOT NULL DEFAULT 'NGN',

    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'successful',
                'failed',
                'refunded'
            )
        ),

    metadata JSONB,

    paid_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_payments_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_payments_subscription
        FOREIGN KEY (subscription_id)
        REFERENCES user_subscriptions(id)
        ON DELETE SET NULL
);


-- ============================================================
-- USAGE TRACKING
-- Tracks monthly usage against subscription limits
-- ============================================================

CREATE TABLE IF NOT EXISTS usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    usage_month DATE NOT NULL,

    audits_count INTEGER NOT NULL DEFAULT 0,

    pages_crawled INTEGER NOT NULL DEFAULT 0,

    keywords_tracked INTEGER NOT NULL DEFAULT 0,

    api_requests INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_usage_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT unique_user_usage_month
        UNIQUE (user_id, usage_month)
);


-- ============================================================
-- API KEYS
-- For future API access
-- ============================================================

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    name VARCHAR(255) NOT NULL,

    key_prefix VARCHAR(20) NOT NULL,

    key_hash TEXT NOT NULL UNIQUE,

    last_used_at TIMESTAMP WITH TIME ZONE,

    expires_at TIMESTAMP WITH TIME ZONE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_api_keys_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


-- ============================================================
-- AUDIT SCHEDULES
-- Automatic recurring audits
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id UUID NOT NULL,

    frequency VARCHAR(50) NOT NULL
        CHECK (
            frequency IN (
                'daily',
                'weekly',
                'monthly'
            )
        ),

    next_run_at TIMESTAMP WITH TIME ZONE,

    last_run_at TIMESTAMP WITH TIME ZONE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_audit_schedules_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE
);


-- ============================================================
-- EMAIL REPORTS
-- Scheduled/automatic reports
-- ============================================================

CREATE TABLE IF NOT EXISTS email_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    project_id UUID NOT NULL,

    email VARCHAR(255) NOT NULL,

    frequency VARCHAR(50) NOT NULL
        CHECK (
            frequency IN (
                'daily',
                'weekly',
                'monthly'
            )
        ),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    last_sent_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_email_reports_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_email_reports_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE
);


-- ============================================================
-- CONTACT / SUPPORT MESSAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID,

    name VARCHAR(255),

    email VARCHAR(255) NOT NULL,

    subject VARCHAR(255),

    message TEXT NOT NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'unread'
        CHECK (
            status IN (
                'unread',
                'read',
                'replied',
                'closed'
            )
        ),

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_contact_messages_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);


-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_projects_user_id
    ON projects(user_id);

CREATE INDEX IF NOT EXISTS idx_projects_domain
    ON projects(domain);

CREATE INDEX IF NOT EXISTS idx_audits_project_id
    ON audits(project_id);

CREATE INDEX IF NOT EXISTS idx_audits_status
    ON audits(status);

CREATE INDEX IF NOT EXISTS idx_audits_created_at
    ON audits(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_pages_audit_id
    ON audit_pages(audit_id);

CREATE INDEX IF NOT EXISTS idx_audit_pages_url
    ON audit_pages(url);

CREATE INDEX IF NOT EXISTS idx_audit_issues_audit_id
    ON audit_issues(audit_id);

CREATE INDEX IF NOT EXISTS idx_audit_issues_page_id
    ON audit_issues(page_id);

CREATE INDEX IF NOT EXISTS idx_audit_issues_severity
    ON audit_issues(severity);

CREATE INDEX IF NOT EXISTS idx_keywords_project_id
    ON keywords(project_id);

CREATE INDEX IF NOT EXISTS idx_keyword_rankings_keyword_id
    ON keyword_rankings(keyword_id);

CREATE INDEX IF NOT EXISTS idx_keyword_rankings_checked_at
    ON keyword_rankings(checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id
    ON user_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status
    ON user_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_payments_user_id
    ON payments(user_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
    ON payments(status);

CREATE INDEX IF NOT EXISTS idx_usage_user_id
    ON usage_records(user_id);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id
    ON api_keys(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_schedules_project_id
    ON audit_schedules(project_id);

CREATE INDEX IF NOT EXISTS idx_email_reports_user_id
    ON email_reports(user_id);


-- ============================================================
-- DEFAULT SUBSCRIPTION PLANS
-- ============================================================

INSERT INTO subscription_plans (
    name,
    slug,
    description,
    price_monthly,
    price_yearly,
    max_projects,
    max_audits_per_month,
    max_pages_per_audit,
    max_keywords,
    features
)
VALUES

(
    'Free',
    'free',
    'For individuals getting started with SEO.',
    0,
    0,
    1,
    5,
    50,
    10,
    '[
        "5 audits per month",
        "50 pages per audit",
        "10 keywords",
        "Basic SEO reports"
    ]'::jsonb
),

(
    'Pro',
    'pro',
    'For freelancers and growing websites.',
    15000,
    150000,
    5,
    50,
    500,
    100,
    '[
        "50 audits per month",
        "500 pages per audit",
        "100 keywords",
        "Advanced reports",
        "Scheduled audits",
        "Email reports"
    ]'::jsonb
),

(
    'Business',
    'business',
    'For agencies and businesses managing multiple websites.',
    50000,
    500000,
    25,
    250,
    5000,
    1000,
    '[
        "250 audits per month",
        "5,000 pages per audit",
        "1,000 keywords",
        "Advanced reports",
        "Scheduled audits",
        "Email reports",
        "API access"
    ]'::jsonb
)

ON CONFLICT (slug) DO NOTHING;