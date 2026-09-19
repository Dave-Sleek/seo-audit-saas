import Link from "next/link";

import Navbar from "@/app/components/ui/navbar";
import Footer from "@/app/components/ui/footer";
import AuditForm from "@/app/components/ui/audit-form";

import HeroOrbs from "@/app/components/landing/HeroOrbs";
import LiveDashboard from "@/app/components/landing/LiveDashboard";
import Reveal from "@/app/components/landing/Reveal";
import AnimatedMetric from "@/app/components/landing/AnimatedMetric";
import LandingImage from "@/app/components/landing/LandingImage";
import IntegrationRow from "@/app/components/landing/IntegrationRow";

import MockImage from "@/app/components/landing/MockImage";
import AnimatedFaq from "@/app/components/landing/AnimatedFaq";
import StickyCta from "@/app/components/landing/StickyCta";



/* =========================================================
   DATA
========================================================= */

const features = [
  {
    title: "Technical SEO",
    description: "Identify technical problems that affect crawling, indexing, and search visibility.",
    icon: GearIcon,
    mock: "technical" as const,
  },
  {
    title: "On-Page SEO",
    description: "Check titles, meta descriptions, headings, canonical URLs, images, and page elements.",
    icon: FileIcon,
    mock: "onpage" as const,
  },
  {
    title: "Crawlability",
    description: "Discover broken pages, redirects, indexing problems, and access issues.",
    icon: SearchIcon,
    mock: "crawl" as const,
  },
  {
    title: "Structured Data",
    description: "Verify schema markup and search-enhancing structured data on every page.",
    icon: PuzzleIcon,
    mock: "schema" as const,
  },
  {
    title: "Social Metadata",
    description: "Check Open Graph and Twitter/X metadata so pages look great when shared.",
    icon: LinkIcon,
    mock: "social" as const,
  },
  {
    title: "AI Recommendations",
    description: "Get practical, prioritized recommendations that explain what to fix first.",
    icon: CheckIcon,
    mock: "ai" as const,
  },
];

const steps = [
  {
    number: "01",
    title: "Enter your website",
    description: "Type a URL. No signup required to try your first audit.",
    mock: "url-input" as const,
  },
  {
    number: "02",
    title: "We crawl your website",
    description: "Our crawler visits every page and runs 100+ SEO checks in parallel.",
    mock: "crawl-progress" as const,
  },
  {
    number: "03",
    title: "Get your SEO report",
    description: "Review scores, issues, affected pages, and prioritized recommendations.",
    mock: "report" as const,
  },
];

const faqs = [
  {
    question: "What is an SEO audit?",
    answer:
      "An SEO audit is an analysis of a website that identifies technical, content, crawlability, structured data, and other issues that may affect search engine visibility.",
  },
  {
    question: "Do I need an account to run an audit?",
    answer:
      "The free audit experience can be used to evaluate a website. An account provides access to saved projects, audit history, and additional features as the platform grows.",
  },
  {
    question: "What does the SEO score mean?",
    answer:
      "The score provides a high-level indication of the health of the pages analyzed. It is based on the SEO issues detected during the crawl and is intended to help you prioritize improvements.",
  },
  {
    question: "Can I audit any website?",
    answer:
      "You can audit publicly accessible websites that allow crawling. Websites that block automated requests or require authentication may not be fully crawlable.",
  },
];

/* =========================================================
   PAGE
========================================================= */

export default function HomePage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      <Navbar />

      <main>
        {/* =====================================================
            HERO — copy + CTAs on left, image placeholder on right
        ====================================================== */}
        <section
          className="relative overflow-hidden"
          style={{ background: "#1a0f08" }}
        >
          <HeroOrbs />

          <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 sm:pb-20 sm:pt-20 lg:px-8 lg:pb-24 lg:pt-24">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              {/* ---------- LEFT: copy + CTAs ---------- */}
              <div className="text-center lg:text-left">
                <div className="lp-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 backdrop-blur-sm">
                  <span className="lp-pulse-dot h-2 w-2 rounded-full bg-emerald-400" />
                  Website SEO analysis made simple
                </div>

                <h1
                  className="lp-fade-up text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-white sm:text-5xl lg:text-6xl"
                  style={{ animationDelay: "100ms" }}
                >
                  Find out what&apos;s{" "}
                  <span
                    style={{
                      background:
                        "linear-gradient(120deg, #f97316 0%, #fbbf24 100%)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    holding your site back.
                  </span>
                </h1>

                <p
                  className="lp-fade-up mx-auto mt-6 max-w-xl text-lg leading-8 text-white lg:mx-0"
                  style={{ animationDelay: "200ms" }}
                >
                  Analyze technical SEO, content, crawlability, structured
                  data, and social metadata. Get a clear score and
                  prioritized recommendations.
                </p>

                {/* CTAs */}
                <div
                  className="lp-fade-up mx-auto mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center lg:mx-0 lg:justify-start"
                  style={{ animationDelay: "300ms" }}
                >
                  <Link
                    href="/register"
                    className="group inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:shadow-xl"
                    style={{ background: "var(--primary)" }}
                  >
                    Get started
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-transform duration-300 group-hover:translate-x-1"
                      aria-hidden="true"
                    >
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </Link>

                  <a
                    href="#run-audit"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/45 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/55"
                  >
                    Learn more
                  </a>
                </div>

                {/* Trust line */}
                <p
                  className="lp-fade-up mt-6 text-xs text-white"
                  style={{ animationDelay: "400ms" }}
                >
                  No setup required · Free first audit · Results in seconds
                </p>
              </div>

              {/* ---------- RIGHT: image placeholder ---------- */}
              <div
                  className="lp-fade-up mx-auto w-full max-w-xl lg:max-w-none"
                  style={{ animationDelay: "500ms" }}
                >
                  <div className="rounded-2xl border border-white/10 bg-[#0f0a06] p-3 shadow-2xl">
                    <MockImage
                      variant="hero"
                      ratio="4/3"
                      className="!border-white/5"
                      label="Product preview"
                    />
                  </div>
                </div>
            </div>
          </div>
        </section>

        {/* =====================================================
            INTEGRATIONS
        ====================================================== */}
        <IntegrationRow />

        {/* =====================================================
            LIVE DASHBOARD — full-width section
        ====================================================== */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="eyebrow" style={{ color: "var(--primary)" }}>
                See it in action
              </p>
              <h2
                className="mt-3 text-3xl font-bold tracking-[-0.02em] sm:text-4xl"
                style={{ color: "var(--text-primary)" }}
              >
                A live look at a real audit
              </h2>
              <p
                className="mt-4 text-lg"
                style={{ color: "var(--text-muted)" }}
              >
                Watch the crawler discover pages, run 100+ checks, and
                surface the issues that matter — all in seconds.
              </p>
            </Reveal>

            <Reveal delayMs={150} className="mx-auto mt-14 max-w-5xl">
              <LiveDashboard />
            </Reveal>
          </div>
        </section>

        {/* =====================================================
            ANIMATED METRICS
        ====================================================== */}
        <section
          className="py-20 sm:py-24"
          style={{ background: "var(--surface)" }}
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="eyebrow" style={{ color: "var(--primary)" }}>
                By the numbers
              </p>
              <h2
                className="mt-3 text-3xl font-bold tracking-[-0.02em] sm:text-4xl"
                style={{ color: "var(--text-primary)" }}
              >
                Every audit, every detail
              </h2>
              <p
                className="mt-4 text-lg"
                style={{ color: "var(--text-muted)" }}
              >
                Thorough crawls in seconds. Clear scores you can act on.
              </p>
            </Reveal>

            <Reveal
              stagger
              className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4"
            >
              <AnimatedMetric
                value={100}
                suffix="+"
                label="SEO checks"
                sublabel="Run on every page"
                delta="+12 this quarter"
                sparkline={[12, 24, 38, 52, 68, 82, 100]}
              />
              <AnimatedMetric
                value={6}
                label="Analysis categories"
                sublabel="Technical to social"
                sparkline={[1, 2, 3, 4, 5, 6]}
              />
              <AnimatedMetric
                value={1200}
                suffix="ms"
                label="Median crawl"
                sublabel="Per page analyzed"
                delta="-18% faster"
                sparkline={[2000, 1750, 1600, 1400, 1300, 1200]}
              />
              <AnimatedMetric
                value={87}
                label="Average site score"
                sublabel="Across all audits"
                delta="+6 pts"
                sparkline={[72, 75, 78, 80, 83, 85, 87]}
              />
            </Reveal>
          </div>
        </section>

        {/* =====================================================
            FEATURES
        ====================================================== */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="eyebrow" style={{ color: "var(--primary)" }}>
                Everything you need
              </p>
              <h2
                className="mt-3 text-3xl font-bold tracking-[-0.02em] sm:text-4xl"
                style={{ color: "var(--text-primary)" }}
              >
                Understand your website&apos;s SEO health
              </h2>
              <p
                className="mt-4 text-lg"
                style={{ color: "var(--text-muted)" }}
              >
                Find the problems that matter, and understand what to do
                about them.
              </p>
            </Reveal>

            <Reveal
              stagger
              className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="lp-lift group flex flex-col rounded-2xl border p-5"
                    style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-lg"
                        style={{ background: "var(--primary-light)", color: "var(--primary)" }}
                      >
                        <Icon />
                      </span>
                    </div>

                    <MockImage variant={feature.mock} ratio="16/9" />

                    <div className="mt-4 flex flex-1 flex-col">
                      <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                        {feature.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                        {feature.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </Reveal>
          </div>
        </section>

        {/* =====================================================
            HOW IT WORKS
        ====================================================== */}
        <section
          className="py-20 sm:py-24"
          style={{ background: "var(--surface)" }}
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="eyebrow" style={{ color: "var(--primary)" }}>
                How it works
              </p>
              <h2
                className="mt-3 text-3xl font-bold tracking-[-0.02em] sm:text-4xl"
                style={{ color: "var(--text-primary)" }}
              >
                SEO analysis in three simple steps
              </h2>
            </Reveal>

            <Reveal
              stagger
              className="mt-14 grid gap-6 md:grid-cols-3"
            >
              {steps.map((step, i) => (
                <div
                  key={step.number}
                  className="lp-lift relative rounded-2xl border p-5"
                  style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <MockImage variant={step.mock} ratio="4/3" />

                  <div className="mt-5">
                    <span
                      className="text-xs font-bold tracking-wider"
                      style={{ color: "var(--primary)" }}
                    >
                      STEP {step.number}
                    </span>

                    <h3 className="mt-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                      {step.title}
                    </h3>

                    <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                      {step.description}
                    </p>
                  </div>

                  {i < steps.length - 1 && (
                    <div
                      className="pointer-events-none absolute -right-3 top-[calc(50%-1px)] hidden h-px w-6 md:block"
                      style={{
                        background: "linear-gradient(90deg, var(--primary) 0%, transparent 100%)",
                        opacity: 0.4,
                      }}
                      aria-hidden="true"
                    />
                  )}
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        {/* =====================================================
            RUN AUDIT — form section
        ====================================================== */}
        <section
          id="run-audit"
          className="relative overflow-hidden py-20 sm:py-24"
          style={{ background: "#1a0f08" }}
        >
          {/* Soft warm glow */}
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(900px 460px at 50% 0%, rgba(249,115,22,0.28), transparent 65%)",
            }}
          />

          <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <Reveal className="text-center">
              <p
                className="text-sm font-semibold uppercase tracking-wider"
                style={{ color: "#fb923c" }}
              >
                Try it now
              </p>
              <h2
                className="mt-3 text-3xl font-bold tracking-[-0.02em] text-white sm:text-4xl"
              >
                Run your free SEO audit
              </h2>
              <p className="mt-4 text-base text-slate-400 sm:text-lg">
                Enter any URL. We&apos;ll crawl it, score it, and show you
                exactly what to fix first.
              </p>
            </Reveal>

            <Reveal delayMs={150} className="mt-10">
              <div
                className="rounded-2xl border border-white/10 bg-white p-3"
                style={{
                  boxShadow:
                    "0 30px 60px -20px rgba(249,115,22,0.35), 0 0 0 1px rgba(255,255,255,0.05)",
                }}
              >
                <AuditForm />
              </div>
            </Reveal>

            <Reveal delayMs={250}>
              <p className="mt-4 text-center text-sm text-slate-500">
                No signup required. Results in seconds.
              </p>
            </Reveal>
          </div>
        </section>

        {/* =====================================================
            VALUE / REPORT PREVIEW
        ====================================================== */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <Reveal>
                <p className="eyebrow" style={{ color: "var(--primary)" }}>
                  Built for action
                </p>

                <h2
                  className="mt-3 text-3xl font-bold tracking-[-0.02em] sm:text-4xl"
                  style={{ color: "var(--text-primary)" }}
                >
                  Stop guessing what&apos;s wrong with your website.
                </h2>

                <p
                  className="mt-5 text-lg leading-8"
                  style={{ color: "var(--text-muted)" }}
                >
                  A good SEO audit shouldn&apos;t just give you a list of
                  technical terms. It should help you understand what is
                  wrong, where it is happening, and what to fix first.
                </p>

                <Reveal stagger className="mt-8 flex flex-col gap-4">
                  {[
                    "Prioritize critical SEO issues",
                    "See which pages are affected",
                    "Understand why each issue matters",
                    "Get recommendations for fixing problems",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: "var(--success-light)",
                          color: "var(--success)",
                        }}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      <span
                        className="text-sm font-medium"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {item}
                      </span>
                    </div>
                  ))}
                </Reveal>

                <Link
                  href="/register"
                  className="btn-stripe btn-stripe-primary group mt-8 inline-flex"
                >
                  Start improving your website
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden="true"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
              </Reveal>

              <Reveal delayMs={150}>
                  <div className="rounded-3xl border p-6 sm:p-8" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
                    <MockImage variant="report" ratio="4/3" className="shadow-lg" />
                  </div>
                </Reveal>
            </div>
          </div>
        </section>

        {/* =====================================================
            TESTIMONIALS
        ====================================================== */}
        <section
          className="py-20 sm:py-24"
          style={{ background: "var(--surface)" }}
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="eyebrow" style={{ color: "var(--primary)" }}>
                Loved by site owners
              </p>
              <h2
                className="mt-3 text-3xl font-bold tracking-[-0.02em] sm:text-4xl"
                style={{ color: "var(--text-primary)" }}
              >
                Teams ship faster with clean audits
              </h2>
            </Reveal>

            <Reveal
              stagger
              className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            >
              {[
                {
                  quote:
                    "The audit report told us exactly what to fix. We shipped the top five recommendations in a week.",
                  name: "Ada Obi",
                  role: "Founder, Meridian",
                },
                {
                  quote:
                    "Cleanest SEO tool we've used. The score is trustworthy and the recommendations are actually actionable.",
                  name: "Daniel Park",
                  role: "Growth Lead, Kite",
                },
                {
                  quote:
                    "Ran the audit on three client sites in a day. The report is client-ready without any extra formatting.",
                  name: "Zainab Bello",
                  role: "Agency Owner",
                },
              ].map((t) => (
                <div
                  key={t.name}
                  className="lp-lift flex flex-col rounded-2xl border p-6"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--border)",
                  }}
                >
                  <div className="flex gap-1" aria-hidden="true">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <svg
                        key={i}
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        style={{ color: "var(--primary)" }}
                      >
                        <polygon points="12 2 15 9 22 9 16 14 18 22 12 17 6 22 8 14 2 9 9 9" />
                      </svg>
                    ))}
                  </div>

                  <p
                    className="mt-4 flex-1 text-sm leading-relaxed"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    &ldquo;{t.quote}&rdquo;
                  </p>

                  <div className="mt-5 flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                      style={{
                        background:
                          "linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)",
                        color: "#c2410c",
                      }}
                    >
                      {t.name.charAt(0)}
                    </div>

                    <div className="min-w-0">
                      <div
                        className="text-sm font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {t.name}
                      </div>
                      <div
                        className="text-xs"
                        style={{ color: "var(--text-subtle)" }}
                      >
                        {t.role}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        {/* =====================================================
            FAQ
        ====================================================== */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <Reveal className="text-center">
              <p className="eyebrow" style={{ color: "var(--primary)" }}>
                FAQ
              </p>
              <h2
                className="mt-3 text-3xl font-bold tracking-[-0.02em] sm:text-4xl"
                style={{ color: "var(--text-primary)" }}
              >
                Frequently asked questions
              </h2>
            </Reveal>

            <Reveal delayMs={100} className="mt-12">
              <AnimatedFaq faqs={faqs} />
            </Reveal>
          </div>
          <StickyCta />
        </section>

        {/* =====================================================
            FINAL CTA
        ====================================================== */}
        <section
          className="relative overflow-hidden py-24"
          style={{ background: "#1a0f08" }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(900px 460px at 50% 100%, rgba(249,115,22,0.40), transparent 65%)",
            }}
          />

          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(600px 300px at 20% 0%, rgba(234,88,12,0.22), transparent 70%)",
            }}
          />

          <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <Reveal>
              <h2 className="text-3xl font-bold tracking-[-0.02em] text-white sm:text-5xl">
                See how healthy your website really is.
              </h2>
            </Reveal>

            <Reveal delayMs={100}>
              <p
                className="mx-auto mt-5 max-w-2xl text-lg"
                style={{ color: "rgba(255, 237, 213, 0.7)" }}
              >
                Run an SEO audit and discover the issues that deserve your
                attention.
              </p>
            </Reveal>

            <Reveal delayMs={200}>
              <Link
                href="/register"
                className="group mt-8 inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:shadow-xl"
                style={{ background: "var(--primary)" }}
              >
                Get started for free
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden="true"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

/* =========================================================
   ICONS
========================================================= */

function HeroMarkIcon() {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="8" />
      <line x1="12" y1="16" x2="12" y2="22" />
      <line x1="2" y1="12" x2="8" y2="12" />
      <line x1="16" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function PuzzleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}