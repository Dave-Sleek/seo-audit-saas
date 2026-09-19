import * as cheerio from "cheerio";

/* =========================================================
   TYPES
========================================================= */

export type SEOIssueSeverity =
  | "critical"
  | "error"
  | "warning"
  | "notice";

export type SEOPriority = "high" | "medium" | "low";

export type SEOIssueCategory =
  | "technical"
  | "on-page"
  | "content"
  | "accessibility"
  | "crawlability"
  | "links"
  | "social"
  | "structured-data";

/**
 * Alias used by sitewide-analyzer.ts.
 * Same union as SEOIssueCategory — kept as a separate
 * export so both names are available where needed.
 */
export type SEOCategory = SEOIssueCategory;

export interface SEOIssue {
  category: SEOIssueCategory;
  type: string;
  severity: SEOIssueSeverity;
  title: string;
  description: string;
  recommendation: string;
}

export type RedirectHop = {
  url: string;
  statusCode: number;
  responseTimeMs: number;
};

export type HTTPAnalysis = {
  statusCode: number;
  finalUrl: string;
  redirectCount: number;
  redirectChain: RedirectHop[];
  responseTimeMs: number;
};

export type SEOCategoryScore = {
  score: number;
  issues: number;
  critical: number;
  errors: number;
  warnings: number;
  notices: number;
};

export type SEOCategoryScores = Record<
  SEOIssueCategory,
  SEOCategoryScore
>;

export type PriorityIssue = SEOIssue & {
  priorityScore: number;
};

export interface SEOAnalysis {
  title: string | null;
  titleLength: number;

  metaDescription: string | null;
  metaDescriptionLength: number;

  canonicalUrl: string | null;

  robotsMeta: string | null;

  h1: string | null;
  h1Count: number;
  h2Count: number;

  wordCount: number;

  internalLinksCount: number;
  externalLinksCount: number;

  imagesCount: number;
  imagesWithoutAlt: number;

  hasHttps: boolean;
  hasSchema: boolean;
  hasOpenGraph: boolean;
  hasTwitterCard: boolean;

  isIndexable: boolean;

  hasViewport: boolean;
  hasLang: boolean;
  hasFavicon: boolean;

  canonicalIsAbsolute: boolean;
  canonicalMatchesPage: boolean | null;

  hasNoindex: boolean;
  hasNofollow: boolean;
  hasNoarchive: boolean;

  emptyHeadingCount: number;
  imagesWithEmptyAlt: number;
  imagesWithLongAlt: number;

  hasOgTitle: boolean;
  hasOgDescription: boolean;
  hasOgImage: boolean;

  hasTwitterTitle: boolean;
  hasTwitterDescription: boolean;
  hasTwitterImage: boolean;

  validJsonLdCount: number;
  invalidJsonLdCount: number;

  score: number;

  categoryScores: SEOCategoryScores;

  priorityIssues: PriorityIssue[];

  issues: SEOIssue[];
}

/* =========================================================
   CATEGORY WEIGHTS
========================================================= */

const CATEGORY_WEIGHTS: Record<SEOIssueCategory, number> = {
  technical: 25,
  "on-page": 25,
  crawlability: 20,
  content: 15,
  links: 10,
  accessibility: 2.5,
  social: 2,
  "structured-data": 0.5,
};

/**
 * The roadmap has 8 categories, but the requested
 * weighting totals 105 because accessibility is treated
 * as its own cross-cutting category.
 *
 * Normalize automatically.
 */
function normalizedCategoryWeight(category: SEOIssueCategory): number {
  const total = Object.values(CATEGORY_WEIGHTS).reduce(
    (sum, value) => sum + value,
    0
  );

  return CATEGORY_WEIGHTS[category] / total;
}

/* =========================================================
   ISSUE SEVERITY WEIGHTS
========================================================= */

const SEVERITY_DEDUCTION: Record<SEOIssueSeverity, number> = {
  critical: 25,
  error: 15,
  warning: 7,
  notice: 2,
};

/**
 * Priority is deliberately different from score
 * deduction.
 *
 * A critical issue should appear near the top even
 * when the category has many notices.
 */
const PRIORITY_WEIGHT: Record<SEOIssueSeverity, number> = {
  critical: 100,
  error: 70,
  warning: 40,
  notice: 15,
};

/* =========================================================
   HELPERS
========================================================= */

function cleanText(value: string | undefined): string | null {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function getNormalizedHost(input: string): string {
  try {
    return new URL(input).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeComparableUrl(input: string): string {
  try {
    const url = new URL(input);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return input.trim().replace(/\/$/, "");
  }
}

function isValidJsonLd(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object";
  } catch {
    return false;
  }
}

function isMeaningfulHeading(text: string): boolean {
  return text.replace(/\s+/g, " ").trim().length > 0;
}

/* =========================================================
   HTTP ANALYSIS
========================================================= */

export function analyzeHttpStatus(http: HTTPAnalysis): SEOIssue[] {
  const issues: SEOIssue[] = [];

  const {
    statusCode,
    finalUrl,
    redirectCount,
    redirectChain,
    responseTimeMs,
  } = http;

  /* ---------- 4XX ---------- */

  if (statusCode >= 400 && statusCode < 500) {
    if (statusCode === 404) {
      issues.push({
        category: "technical",
        type: "http-404",
        severity: "error",
        title: "404 Not Found",
        description:
          "This URL returns HTTP 404, meaning the requested page could not be found.",
        recommendation:
          "Restore the page, redirect it to a relevant replacement, or remove internal links pointing to it.",
      });
    } else if (statusCode === 410) {
      issues.push({
        category: "technical",
        type: "http-410",
        severity: "error",
        title: "410 Gone",
        description:
          "This URL returns HTTP 410 and has been permanently removed.",
        recommendation:
          "Confirm that the removal is intentional and remove unnecessary internal links.",
      });
    } else {
      issues.push({
        category: "technical",
        type: "http-4xx",
        severity: "error",
        title: `HTTP ${statusCode} client error`,
        description: `The URL returned HTTP ${statusCode}.`,
        recommendation:
          "Fix the URL or server configuration so the page returns a valid response.",
      });
    }
  }

  /* ---------- 5XX ---------- */

  if (statusCode >= 500) {
    issues.push({
      category: "technical",
      type: "http-5xx",
      severity: "critical",
      title: `HTTP ${statusCode} server error`,
      description: `The server returned HTTP ${statusCode}. Search engines and visitors may be unable to access this page.`,
      recommendation:
        "Investigate the server or application error and make sure the page returns HTTP 200 when it is available.",
    });
  }

  /* ---------- FINAL 3XX ---------- */

  if (statusCode >= 300 && statusCode < 400) {
    issues.push({
      category: "technical",
      type: "http-redirect",
      severity: "warning",
      title: `Page ends with HTTP ${statusCode}`,
      description:
        "The crawler received a redirect response instead of a final page response.",
      recommendation:
        "Make sure the redirect resolves to a final HTTP 200 page.",
    });
  }

  /* ---------- REDIRECTS ---------- */

  if (redirectCount === 1) {
    issues.push({
      category: "crawlability",
      type: "redirect",
      severity: "notice",
      title: "Page uses a redirect",
      description: `This URL redirects to ${finalUrl}.`,
      recommendation:
        "Where practical, link directly to the final destination instead of routing visitors through a redirect.",
    });
  }

  if (redirectCount >= 2 && redirectCount <= 3) {
    issues.push({
      category: "crawlability",
      type: "redirect-chain",
      severity: "warning",
      title: `Redirect chain detected (${redirectCount} redirects)`,
      description: `This URL requires ${redirectCount} redirects before reaching the final destination.`,
      recommendation:
        "Update internal links to point directly to the final URL and remove unnecessary redirect hops.",
    });
  }

  if (redirectCount > 3) {
    issues.push({
      category: "crawlability",
      type: "long-redirect-chain",
      severity: "error",
      title: `Long redirect chain (${redirectCount} redirects)`,
      description: `This URL requires ${redirectCount} redirects before reaching its final destination.`,
      recommendation:
        "Replace the redirect chain with a direct redirect to the final destination.",
    });
  }

  /* ---------- RESPONSE TIME ---------- */

  if (responseTimeMs >= 3000) {
    issues.push({
      category: "technical",
      type: "slow-response",
      severity: "error",
      title: "Very slow server response",
      description: `The page took ${responseTimeMs}ms to respond.`,
      recommendation:
        "Investigate server-side performance, database queries, caching, hosting resources, and application response time.",
    });
  } else if (responseTimeMs >= 2000) {
    issues.push({
      category: "technical",
      type: "slow-response",
      severity: "warning",
      title: "Slow server response",
      description: `The page took ${responseTimeMs}ms to respond.`,
      recommendation:
        "Improve server response time through caching, query optimization, hosting improvements, or application performance optimization.",
    });
  } else if (responseTimeMs >= 1000) {
    issues.push({
      category: "technical",
      type: "response-time",
      severity: "notice",
      title: "Response time could be improved",
      description: `The page took ${responseTimeMs}ms to respond.`,
      recommendation:
        "Consider optimizing server-side processing and caching to reduce response time.",
    });
  }

  /* ---------- HTTP → HTTPS ---------- */

  if (redirectChain.length >= 2) {
    const firstUrl = redirectChain[0]?.url;

    if (
      firstUrl?.toLowerCase().startsWith("http://") &&
      finalUrl.toLowerCase().startsWith("https://")
    ) {
      issues.push({
        category: "technical",
        type: "http-to-https-redirect",
        severity: "notice",
        title: "HTTP URL redirects to HTTPS",
        description:
          "The requested HTTP URL redirects to an HTTPS version.",
        recommendation:
          "Prefer linking directly to the HTTPS URL throughout the website.",
      });
    }
  }

  return issues;
}

/* =========================================================
   CATEGORY SCORING
========================================================= */

const ALL_CATEGORIES: SEOIssueCategory[] = [
  "technical",
  "on-page",
  "crawlability",
  "content",
  "links",
  "accessibility",
  "social",
  "structured-data",
];

function createEmptyCategoryScores(): SEOCategoryScores {
  return {
    technical: {
      score: 100,
      issues: 0,
      critical: 0,
      errors: 0,
      warnings: 0,
      notices: 0,
    },
    "on-page": {
      score: 100,
      issues: 0,
      critical: 0,
      errors: 0,
      warnings: 0,
      notices: 0,
    },
    crawlability: {
      score: 100,
      issues: 0,
      critical: 0,
      errors: 0,
      warnings: 0,
      notices: 0,
    },
    content: {
      score: 100,
      issues: 0,
      critical: 0,
      errors: 0,
      warnings: 0,
      notices: 0,
    },
    links: {
      score: 100,
      issues: 0,
      critical: 0,
      errors: 0,
      warnings: 0,
      notices: 0,
    },
    accessibility: {
      score: 100,
      issues: 0,
      critical: 0,
      errors: 0,
      warnings: 0,
      notices: 0,
    },
    social: {
      score: 100,
      issues: 0,
      critical: 0,
      errors: 0,
      warnings: 0,
      notices: 0,
    },
    "structured-data": {
      score: 100,
      issues: 0,
      critical: 0,
      errors: 0,
      warnings: 0,
      notices: 0,
    },
  };
}

function calculateCategoryScores(
  issues: SEOIssue[]
): SEOCategoryScores {
  const result = createEmptyCategoryScores();

  for (const issue of issues) {
    const category = result[issue.category];
    if (!category) continue;

    category.issues++;

    if (issue.severity === "critical") category.critical++;
    if (issue.severity === "error") category.errors++;
    if (issue.severity === "warning") category.warnings++;
    if (issue.severity === "notice") category.notices++;

    category.score = Math.max(
      0,
      category.score - SEVERITY_DEDUCTION[issue.severity]
    );
  }

  return result;
}

/**
 * Calculate weighted overall score.
 */
function calculateWeightedScore(
  categoryScores: SEOCategoryScores
): number {
  let weightedScore = 0;

  for (const category of ALL_CATEGORIES) {
    weightedScore +=
      categoryScores[category].score * normalizedCategoryWeight(category);
  }

  return Math.max(0, Math.min(100, Math.round(weightedScore)));
}

/* =========================================================
   PRIORITY ISSUES
========================================================= */

function calculatePriorityIssues(
  issues: SEOIssue[]
): PriorityIssue[] {
  return issues
    .map((issue) => ({
      ...issue,
      priorityScore: PRIORITY_WEIGHT[issue.severity],
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 10);
}

/* =========================================================
   EMPTY ANALYSIS
========================================================= */

function createEmptyAnalysis(
  pageUrl: string,
  issues: SEOIssue[]
): SEOAnalysis {
  const categoryScores = calculateCategoryScores(issues);

  return {
    title: null,
    titleLength: 0,

    metaDescription: null,
    metaDescriptionLength: 0,

    canonicalUrl: null,

    robotsMeta: null,

    h1: null,
    h1Count: 0,
    h2Count: 0,

    wordCount: 0,

    internalLinksCount: 0,
    externalLinksCount: 0,

    imagesCount: 0,
    imagesWithoutAlt: 0,

    hasHttps: pageUrl.toLowerCase().startsWith("https://"),

    hasSchema: false,
    hasOpenGraph: false,
    hasTwitterCard: false,

    isIndexable: false,

    hasViewport: false,
    hasLang: false,
    hasFavicon: false,

    canonicalIsAbsolute: false,
    canonicalMatchesPage: null,

    hasNoindex: false,
    hasNofollow: false,
    hasNoarchive: false,

    emptyHeadingCount: 0,
    imagesWithEmptyAlt: 0,
    imagesWithLongAlt: 0,

    hasOgTitle: false,
    hasOgDescription: false,
    hasOgImage: false,

    hasTwitterTitle: false,
    hasTwitterDescription: false,
    hasTwitterImage: false,

    validJsonLdCount: 0,
    invalidJsonLdCount: 0,

    score: calculateWeightedScore(categoryScores),

    categoryScores,

    priorityIssues: calculatePriorityIssues(issues),

    issues,
  };
}

/* =========================================================
   MAIN ANALYZER
========================================================= */

export function analyzePage(
  html: string,
  pageUrl: string,
  http?: HTTPAnalysis
): SEOAnalysis {
  /* -------------------------------------------------------
     HTTP FAILURE PAGES
  ------------------------------------------------------- */

  const failedHttpStatus =
    http &&
    (http.statusCode >= 400 ||
      (http.statusCode >= 300 && http.statusCode < 400));

  if (failedHttpStatus) {
    const issues = analyzeHttpStatus(http);
    return createEmptyAnalysis(pageUrl, issues);
  }

  /* -------------------------------------------------------
     INVALID HTML
  ------------------------------------------------------- */

  if (!html || typeof html !== "string") {
    const issues: SEOIssue[] = [
      {
        category: "technical",
        type: "invalid-html",
        severity: "critical",
        title: "Unable to analyze page",
        description:
          "The crawler did not return valid HTML content for this page.",
        recommendation:
          "Make sure the URL returns a valid HTML document.",
      },
    ];

    if (http) {
      issues.push(...analyzeHttpStatus(http));
    }

    return createEmptyAnalysis(pageUrl, issues);
  }

  /* -------------------------------------------------------
     LOAD HTML
  ------------------------------------------------------- */

  const $ = cheerio.load(html);
  const issues: SEOIssue[] = [];

  /* -------------------------------------------------------
     TITLE
  ------------------------------------------------------- */

  const title = cleanText($("title").first().text());
  const titleLength = title?.length ?? 0;

  /* -------------------------------------------------------
     META DESCRIPTION
  ------------------------------------------------------- */

  const metaDescription = cleanText(
    $('meta[name="description"]').first().attr("content")
  );
  const metaDescriptionLength = metaDescription?.length ?? 0;

  /* -------------------------------------------------------
     CANONICAL
  ------------------------------------------------------- */

  const canonicalUrl = cleanText(
    $('link[rel="canonical"]').first().attr("href")
  );

  let canonicalIsAbsolute = false;
  let canonicalMatchesPage: boolean | null = null;

  if (canonicalUrl) {
    try {
      const absoluteCanonical = new URL(canonicalUrl, pageUrl).toString();

      canonicalIsAbsolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(canonicalUrl);

      canonicalMatchesPage =
        normalizeComparableUrl(absoluteCanonical) ===
        normalizeComparableUrl(pageUrl);
    } catch {
      canonicalIsAbsolute = false;
      canonicalMatchesPage = false;
    }
  }

  /* -------------------------------------------------------
     ROBOTS
  ------------------------------------------------------- */

  const robotsMeta = cleanText(
    $('meta[name="robots"]').first().attr("content")
  );

  const robotsLower = robotsMeta?.toLowerCase() ?? "";

  const hasNoindex = robotsLower.includes("noindex");
  const hasNofollow = robotsLower.includes("nofollow");
  const hasNoarchive = robotsLower.includes("noarchive");

  const isIndexable = !hasNoindex;

  /* -------------------------------------------------------
     HEADINGS
  ------------------------------------------------------- */

  const h1Elements = $("h1");
  const h1Count = h1Elements.length;
  const h1 = cleanText(h1Elements.first().text());
  const h2Count = $("h2").length;

  let emptyHeadingCount = 0;

  $("h1, h2, h3, h4, h5, h6").each((_, element) => {
    const text = $(element).text().trim();
    if (!isMeaningfulHeading(text)) emptyHeadingCount++;
  });

  /* -------------------------------------------------------
     WORD COUNT
  ------------------------------------------------------- */

  const bodyText = $("body")
    .clone()
    .find("script, style, noscript, svg, iframe, template")
    .remove()
    .end()
    .text()
    .replace(/\s+/g, " ")
    .trim();

  const wordCount = bodyText
    ? bodyText.split(/\s+/).filter(Boolean).length
    : 0;

  /* -------------------------------------------------------
     PAGE HOST
  ------------------------------------------------------- */

  const pageHost = getNormalizedHost(pageUrl);

  /* -------------------------------------------------------
     LINKS
  ------------------------------------------------------- */

  let internalLinksCount = 0;
  let externalLinksCount = 0;

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href")?.trim();
    if (!href) return;

    if (
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:") ||
      href.startsWith("data:")
    ) {
      return;
    }

    try {
      const absoluteUrl = new URL(href, pageUrl);

      if (
        absoluteUrl.protocol !== "http:" &&
        absoluteUrl.protocol !== "https:"
      ) {
        return;
      }

      const hostname = getNormalizedHost(absoluteUrl.toString());

      if (pageHost && hostname === pageHost) {
        internalLinksCount++;
      } else {
        externalLinksCount++;
      }
    } catch {
      // Ignore malformed URLs.
    }
  });

  /* -------------------------------------------------------
     IMAGES
  ------------------------------------------------------- */

  const imagesCount = $("img").length;

  let imagesWithoutAlt = 0;
  let imagesWithEmptyAlt = 0;
  let imagesWithLongAlt = 0;

  $("img").each((_, element) => {
    const alt = $(element).attr("alt");

    if (alt === undefined) {
      imagesWithoutAlt++;
      return;
    }

    const trimmed = alt.trim();

    if (!trimmed) {
      imagesWithoutAlt++;
      imagesWithEmptyAlt++;
      return;
    }

    if (trimmed.length > 125) {
      imagesWithLongAlt++;
    }
  });

  /* -------------------------------------------------------
     HTTPS
  ------------------------------------------------------- */

  let hasHttps = false;

  try {
    hasHttps = new URL(pageUrl).protocol === "https:";
  } catch {
    hasHttps = pageUrl.toLowerCase().startsWith("https://");
  }

  /* -------------------------------------------------------
     VIEWPORT
  ------------------------------------------------------- */

  const hasViewport = $('meta[name="viewport"]').length > 0;

  /* -------------------------------------------------------
     HTML LANG
  ------------------------------------------------------- */

  const htmlLang = $("html").first().attr("lang")?.trim();
  const hasLang = Boolean(htmlLang);

  /* -------------------------------------------------------
     FAVICON
  ------------------------------------------------------- */

  const hasFavicon =
    $('link[rel~="icon"], link[rel="shortcut icon"]').length > 0;

  /* -------------------------------------------------------
     STRUCTURED DATA
  ------------------------------------------------------- */

  const jsonLdScripts = $('script[type="application/ld+json"]');
  const hasSchema = jsonLdScripts.length > 0;

  let validJsonLdCount = 0;
  let invalidJsonLdCount = 0;

  jsonLdScripts.each((_, element) => {
    const raw = $(element).html()?.trim();

    if (raw && isValidJsonLd(raw)) {
      validJsonLdCount++;
    } else {
      invalidJsonLdCount++;
    }
  });

  /* -------------------------------------------------------
     OPEN GRAPH
  ------------------------------------------------------- */

  const hasOgTitle = $('meta[property="og:title"]').length > 0;
  const hasOgDescription = $('meta[property="og:description"]').length > 0;
  const hasOgImage = $('meta[property="og:image"]').length > 0;

  const hasOpenGraph = hasOgTitle || hasOgDescription || hasOgImage;

  /* -------------------------------------------------------
     TWITTER / X
  ------------------------------------------------------- */

  const hasTwitterTitle = $('meta[name="twitter:title"]').length > 0;
  const hasTwitterDescription =
    $('meta[name="twitter:description"]').length > 0;
  const hasTwitterImage = $('meta[name="twitter:image"]').length > 0;

  const hasTwitterCard =
    $('meta[name="twitter:card"]').length > 0 ||
    hasTwitterTitle ||
    hasTwitterDescription ||
    hasTwitterImage;

  /* =======================================================
     SEO CHECKS
  ======================================================= */

  /* ---------- TITLE ---------- */

  if (!title) {
    issues.push({
      category: "on-page",
      type: "missing-title",
      severity: "error",
      title: "Missing page title",
      description: "This page does not have a title element.",
      recommendation: "Add a unique and descriptive title for this page.",
    });
  } else if (titleLength < 30) {
    issues.push({
      category: "on-page",
      type: "short-title",
      severity: "warning",
      title: "Title is too short",
      description: `The title contains only ${titleLength} characters.`,
      recommendation:
        "Consider creating a more descriptive title that clearly explains the page.",
    });
  } else if (titleLength > 60) {
    issues.push({
      category: "on-page",
      type: "long-title",
      severity: "warning",
      title: "Title may be too long",
      description: `The title contains ${titleLength} characters.`,
      recommendation:
        "Keep the most important title content near the beginning.",
    });
  }

  /* ---------- META DESCRIPTION ---------- */

  if (!metaDescription) {
    issues.push({
      category: "on-page",
      type: "missing-meta-description",
      severity: "error",
      title: "Missing meta description",
      description: "The page does not have a meta description.",
      recommendation: "Add a unique and useful meta description for this page.",
    });
  } else if (metaDescriptionLength < 120) {
    issues.push({
      category: "on-page",
      type: "short-meta-description",
      severity: "warning",
      title: "Meta description is short",
      description: `The meta description contains ${metaDescriptionLength} characters.`,
      recommendation:
        "Provide more useful context while keeping the description concise.",
    });
  } else if (metaDescriptionLength > 160) {
    issues.push({
      category: "on-page",
      type: "long-meta-description",
      severity: "warning",
      title: "Meta description may be too long",
      description: `The meta description contains ${metaDescriptionLength} characters.`,
      recommendation:
        "Keep the most important information near the beginning.",
    });
  }

  /* ---------- CANONICAL ---------- */

  if (!canonicalUrl) {
    issues.push({
      category: "technical",
      type: "missing-canonical",
      severity: "notice",
      title: "Canonical URL is missing",
      description: "No canonical link was detected on this page.",
      recommendation:
        "Add a canonical URL to indicate the preferred version of the page.",
    });
  } else {
    if (!canonicalIsAbsolute) {
      issues.push({
        category: "technical",
        type: "relative-canonical",
        severity: "notice",
        title: "Canonical URL is relative",
        description: "The canonical URL is not an absolute URL.",
        recommendation:
          "Consider using an absolute canonical URL such as https://example.com/page.",
      });
    }

    if (canonicalMatchesPage === false) {
      issues.push({
        category: "technical",
        type: "canonical-mismatch",
        severity: "warning",
        title: "Canonical URL does not match the page",
        description:
          "The canonical URL points to a different URL than the page being analyzed.",
        recommendation:
          "Confirm that the canonical target is intentional and represents the preferred version of this page.",
      });
    }
  }

  /* ---------- H1 ---------- */

  if (h1Count === 0) {
    issues.push({
      category: "on-page",
      type: "missing-h1",
      severity: "error",
      title: "Missing H1 heading",
      description: "No H1 heading was found on this page.",
      recommendation:
        "Add one clear H1 heading describing the main topic of the page.",
    });
  } else if (h1Count > 1) {
    issues.push({
      category: "on-page",
      type: "multiple-h1",
      severity: "warning",
      title: "Multiple H1 headings",
      description: `This page contains ${h1Count} H1 headings.`,
      recommendation:
        "Use one primary H1 heading for the main topic where practical.",
    });
  }

  /* ---------- EMPTY HEADINGS ---------- */

  if (emptyHeadingCount > 0) {
    issues.push({
      category: "content",
      type: "empty-heading",
      severity: "warning",
      title: "Empty heading detected",
      description: `${emptyHeadingCount} heading element(s) contain no meaningful text.`,
      recommendation: "Remove empty headings or give them meaningful text.",
    });
  }

  /* ---------- HTTPS ---------- */

  if (!hasHttps) {
    issues.push({
      category: "technical",
      type: "no-https",
      severity: "critical",
      title: "HTTPS is not being used",
      description: "The page is using HTTP instead of HTTPS.",
      recommendation: "Enable HTTPS and redirect HTTP traffic to HTTPS.",
    });
  }

  /* ---------- VIEWPORT ---------- */

  if (!hasViewport) {
    issues.push({
      category: "technical",
      type: "missing-viewport",
      severity: "warning",
      title: "Viewport metadata is missing",
      description: "The page does not define a viewport meta tag.",
      recommendation:
        'Add a responsive viewport such as <meta name="viewport" content="width=device-width, initial-scale=1">.',
    });
  }

  /* ---------- LANGUAGE ---------- */

  if (!hasLang) {
    issues.push({
      category: "accessibility",
      type: "missing-lang",
      severity: "warning",
      title: "HTML language attribute is missing",
      description:
        "The document does not define a language on the HTML element.",
      recommendation: 'Add an appropriate lang attribute, such as lang="en".',
    });
  }

  /* ---------- FAVICON ---------- */

  if (!hasFavicon) {
    issues.push({
      category: "technical",
      type: "missing-favicon",
      severity: "notice",
      title: "Favicon is missing",
      description: "No favicon link was detected.",
      recommendation:
        "Add a favicon to improve browser and brand presentation.",
    });
  }

  /* ---------- IMAGES ---------- */

  if (imagesWithoutAlt > 0) {
    issues.push({
      category: "accessibility",
      type: "missing-image-alt",
      severity: "warning",
      title: "Images are missing alt text",
      description: `${imagesWithoutAlt} of ${imagesCount} images do not have alt text.`,
      recommendation:
        "Add descriptive alt text to meaningful images. Decorative images can use an empty alt attribute.",
    });
  }

  if (imagesWithLongAlt > 0) {
    issues.push({
      category: "accessibility",
      type: "long-image-alt",
      severity: "notice",
      title: "Some image alt text is very long",
      description: `${imagesWithLongAlt} image(s) have alt text longer than 125 characters.`,
      recommendation:
        "Keep alt text concise and focused on the useful meaning of the image.",
    });
  }

  /* ---------- STRUCTURED DATA ---------- */

  if (!hasSchema) {
    issues.push({
      category: "structured-data",
      type: "missing-schema",
      severity: "notice",
      title: "No structured data detected",
      description: "No JSON-LD structured data was detected.",
      recommendation:
        "Consider adding appropriate Schema.org structured data where relevant.",
    });
  }

  if (invalidJsonLdCount > 0) {
    issues.push({
      category: "structured-data",
      type: "invalid-json-ld",
      severity: "warning",
      title: "Invalid JSON-LD detected",
      description: `${invalidJsonLdCount} JSON-LD block(s) could not be parsed as valid JSON.`,
      recommendation:
        "Validate the JSON-LD syntax and make sure the structured data contains valid JSON.",
    });
  }

  /* ---------- OPEN GRAPH ---------- */

  if (!hasOpenGraph) {
    issues.push({
      category: "social",
      type: "missing-open-graph",
      severity: "notice",
      title: "Open Graph metadata is missing",
      description: "Open Graph metadata was not detected.",
      recommendation: "Add Open Graph metadata for better social sharing.",
    });
  } else {
    if (!hasOgTitle) {
      issues.push({
        category: "social",
        type: "missing-og-title",
        severity: "notice",
        title: "Open Graph title is missing",
        description: "The page does not define og:title.",
        recommendation: "Add an og:title value for social sharing.",
      });
    }

    if (!hasOgDescription) {
      issues.push({
        category: "social",
        type: "missing-og-description",
        severity: "notice",
        title: "Open Graph description is missing",
        description: "The page does not define og:description.",
        recommendation: "Add an og:description value for social sharing.",
      });
    }

    if (!hasOgImage) {
      issues.push({
        category: "social",
        type: "missing-og-image",
        severity: "notice",
        title: "Open Graph image is missing",
        description: "The page does not define og:image.",
        recommendation: "Add an og:image suitable for social sharing.",
      });
    }
  }

  /* ---------- TWITTER / X ---------- */

  if (!hasTwitterCard) {
    issues.push({
      category: "social",
      type: "missing-twitter-card",
      severity: "notice",
      title: "Twitter/X card metadata is missing",
      description: "Twitter/X card metadata was not detected.",
      recommendation:
        "Consider adding Twitter/X Card metadata for social sharing.",
    });
  } else {
    if (!hasTwitterTitle) {
      issues.push({
        category: "social",
        type: "missing-twitter-title",
        severity: "notice",
        title: "Twitter/X title is missing",
        description: "The page does not define twitter:title.",
        recommendation: "Add twitter:title for better social previews.",
      });
    }

    if (!hasTwitterDescription) {
      issues.push({
        category: "social",
        type: "missing-twitter-description",
        severity: "notice",
        title: "Twitter/X description is missing",
        description: "The page does not define twitter:description.",
        recommendation: "Add twitter:description for better social previews.",
      });
    }

    if (!hasTwitterImage) {
      issues.push({
        category: "social",
        type: "missing-twitter-image",
        severity: "notice",
        title: "Twitter/X image is missing",
        description: "The page does not define twitter:image.",
        recommendation: "Add twitter:image for richer social previews.",
      });
    }
  }

  /* ---------- CONTENT ---------- */

  if (wordCount < 300) {
    issues.push({
      category: "content",
      type: "low-word-count",
      severity: "notice",
      title: "Low visible text content",
      description: `Approximately ${wordCount} words were detected.`,
      recommendation:
        "Make sure the page provides enough useful content for its purpose. Short pages can be appropriate when the page's purpose does not require more content.",
    });
  }

  /* ---------- INTERNAL LINKS ---------- */

  if (internalLinksCount === 0) {
    issues.push({
      category: "links",
      type: "no-internal-links",
      severity: "notice",
      title: "No internal links detected",
      description: "No internal links were detected on this page.",
      recommendation:
        "Add relevant internal links where they help users and search engines discover related content.",
    });
  }

  /* ---------- INDEXABILITY ---------- */

  if (hasNoindex) {
    issues.push({
      category: "crawlability",
      type: "noindex",
      severity: "notice",
      title: "Page is marked noindex",
      description: "The robots meta tag contains a noindex directive.",
      recommendation:
        "If this page is intentionally excluded from search engines, no action is required. Otherwise, remove the noindex directive.",
    });
  }

  if (hasNofollow) {
    issues.push({
      category: "crawlability",
      type: "nofollow",
      severity: "notice",
      title: "Page contains a nofollow directive",
      description: "The robots meta tag contains a nofollow directive.",
      recommendation:
        "Confirm that preventing search engines from following links on this page is intentional.",
    });
  }

  if (hasNoarchive) {
    issues.push({
      category: "crawlability",
      type: "noarchive",
      severity: "notice",
      title: "Page contains a noarchive directive",
      description: "The robots meta tag contains a noarchive directive.",
      recommendation:
        "Confirm that preventing search engines from displaying a cached copy is intentional.",
    });
  }

  /* ---------- HTTP ANALYSIS ---------- */

  if (http) {
    issues.push(...analyzeHttpStatus(http));
  }

  /* =======================================================
     SCORE
  ======================================================= */

  const categoryScores = calculateCategoryScores(issues);
  const score = calculateWeightedScore(categoryScores);
  const priorityIssues = calculatePriorityIssues(issues);

  /* =======================================================
     RESULT
  ======================================================= */

  return {
    title,
    titleLength,

    metaDescription,
    metaDescriptionLength,

    canonicalUrl,

    robotsMeta,

    h1,
    h1Count,
    h2Count,

    wordCount,

    internalLinksCount,
    externalLinksCount,

    imagesCount,
    imagesWithoutAlt,

    hasHttps,
    hasSchema,
    hasOpenGraph,
    hasTwitterCard,

    isIndexable,

    hasViewport,
    hasLang,
    hasFavicon,

    canonicalIsAbsolute,
    canonicalMatchesPage,

    hasNoindex,
    hasNofollow,
    hasNoarchive,

    emptyHeadingCount,
    imagesWithEmptyAlt,
    imagesWithLongAlt,

    hasOgTitle,
    hasOgDescription,
    hasOgImage,

    hasTwitterTitle,
    hasTwitterDescription,
    hasTwitterImage,

    validJsonLdCount,
    invalidJsonLdCount,

    score,

    categoryScores,

    priorityIssues,

    issues,
  };
}

/**
 * Backward-compatible alias.
 */
export const analyzeSEO = analyzePage;