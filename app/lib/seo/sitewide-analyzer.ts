import type {
  SEOCategory,
  SEOIssue,
  SEOIssueSeverity,
  SEOPriority,
} from "./analyzer";

export type SitewidePage = {
  id: string;
  url: string;
  finalUrl?: string | null;

  statusCode?: number | null;

  title?: string | null;
  titleLength?: number | null;

  metaDescription?: string | null;
  metaDescriptionLength?: number | null;

  canonicalUrl?: string | null;

  wordCount?: number | null;

  internalLinksCount?: number | null;

  redirectCount?: number | null;

  redirectChain?: Array<{
    url: string;
    statusCode: number;
    responseTimeMs: number;
  }> | null;

  pageScore?: number | null;

  isIndexable?: boolean | null;
};

export type SitewideLink = {
  sourcePageId: string;
  sourceUrl: string;

  targetUrl: string;
  normalizedTargetUrl: string;

  anchorText?: string | null;

  isInternal: boolean;

  targetStatusCode?: number | null;

  targetPageId?: string | null;

  isBroken: boolean;
};

export type SitewideIssue = SEOIssue & {
  affectedPages: string[];
  affectedCount: number;
};

export type SitewideAnalysis = {
  score: number;

  pagesAnalyzed: number;

  duplicateTitles: number;

  duplicateMetaDescriptions: number;

  thinContentPages: number;

  orphanPages: number;

  brokenInternalLinks: number;

  canonicalConflicts: number;

  redirectChains: number;

  issues: SitewideIssue[];

  priorityIssues: SitewideIssue[];

  duplicateTitleGroups: Array<{
    value: string;
    count: number;
    pages: string[];
  }>;

  duplicateMetaGroups: Array<{
    value: string;
    count: number;
    pages: string[];
  }>;

  thinContent: Array<{
    url: string;
    wordCount: number;
  }>;

  orphanPageList: string[];

  brokenLinks: Array<{
    sourceUrl: string;
    targetUrl: string;
    statusCode: number | null;
  }>;

  canonicalConflicts: Array<{
    url: string;
    canonical: string;
  }>;

  redirectChains: Array<{
    url: string;
    redirectCount: number;
    chain: SitewidePage["redirectChain"];
  }>;
};

const PRIORITY_ORDER: Record<SEOPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const SEVERITY_ORDER: Record<SEOIssueSeverity, number> = {
  critical: 4,
  error: 3,
  warning: 2,
  notice: 1,
};

function priorityForSeverity(
  severity: SEOIssueSeverity
): SEOPriority {
  if (
    severity === "critical" ||
    severity === "error"
  ) {
    return "high";
  }

  if (severity === "warning") {
    return "medium";
  }

  return "low";
}

function createIssue(
  category: SEOCategory,
  type: string,
  severity: SEOIssueSeverity,
  title: string,
  description: string,
  recommendation: string,
  affectedPages: string[],
  weight = 3
): SitewideIssue {
  return {
    category,
    type,
    severity,
    priority: priorityForSeverity(severity),
    weight,
    title,
    description,
    recommendation,
    affectedPages,
    affectedCount: affectedPages.length,
  };
}

function normalizeText(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);

    url.hash = "";

    return url.toString().replace(/\/$/, "");
  } catch {
    return value
      .trim()
      .replace(/\/$/, "");
  }
}

function buildGroups(
  pages: SitewidePage[],
  selector: (page: SitewidePage) => string | null | undefined
) {
  const groups = new Map<
    string,
    string[]
  >();

  for (const page of pages) {
    const value = selector(page);

    if (!value || !value.trim()) {
      continue;
    }

    const normalized = normalizeText(value);

    if (!normalized) {
      continue;
    }

    const existing = groups.get(normalized) ?? [];

    existing.push(page.url);

    groups.set(normalized, existing);
  }

  return [...groups.entries()]
    .filter(([, urls]) => urls.length > 1)
    .map(([value, urls]) => ({
      value,
      count: urls.length,
      pages: urls,
    }));
}

function calculateSitewideScore(
  pages: SitewidePage[],
  issueCount: number,
  duplicateTitles: number,
  duplicateMeta: number,
  thinContent: number,
  orphanPages: number,
  brokenLinks: number,
  canonicalConflicts: number,
  redirectChains: number
) {
  if (pages.length === 0) {
    return 0;
  }

  /*
   * Sitewide deductions are deliberately smaller than
   * page-level deductions. A single problem should not
   * destroy an entire site's score.
   */
  let deduction = 0;

  deduction += Math.min(
    20,
    duplicateTitles * 4
  );

  deduction += Math.min(
    15,
    duplicateMeta * 3
  );

  deduction += Math.min(
    15,
    thinContent * 2
  );

  deduction += Math.min(
    15,
    orphanPages * 3
  );

  deduction += Math.min(
    20,
    brokenLinks * 4
  );

  deduction += Math.min(
    10,
    canonicalConflicts * 3
  );

  deduction += Math.min(
    10,
    redirectChains * 2
  );

  /*
   * Small penalty for the existence of sitewide issues
   * that aren't represented by the counters above.
   */
  deduction += Math.min(
    5,
    issueCount
  );

  return Math.max(
    0,
    Math.min(100, Math.round(100 - deduction))
  );
}

export function analyzeSitewide(
  pages: SitewidePage[],
  links: SitewideLink[] = []
): SitewideAnalysis {
  const issues: SitewideIssue[] = [];

  /*
   * -----------------------------------------------------
   * DUPLICATE TITLES
   * -----------------------------------------------------
   */
  const duplicateTitleGroups = buildGroups(
    pages,
    (page) => page.title
  );

  for (const group of duplicateTitleGroups) {
    issues.push(
      createIssue(
        "on-page",
        "duplicate-title",
        "error",
        "Duplicate page titles detected",
        `${group.count} pages share the same title.`,
        "Give each important indexable page a unique, descriptive title.",
        group.pages,
        5
      )
    );
  }

  /*
   * -----------------------------------------------------
   * DUPLICATE META DESCRIPTIONS
   * -----------------------------------------------------
   */
  const duplicateMetaGroups = buildGroups(
    pages,
    (page) => page.metaDescription
  );

  for (const group of duplicateMetaGroups) {
    issues.push(
      createIssue(
        "on-page",
        "duplicate-meta-description",
        "warning",
        "Duplicate meta descriptions detected",
        `${group.count} pages share the same meta description.`,
        "Write unique descriptions that accurately summarize each page.",
        group.pages,
        3
      )
    );
  }

  /*
   * -----------------------------------------------------
   * THIN CONTENT
   * -----------------------------------------------------
   *
   * We use 300 words as the warning threshold,
   * matching the page-level analyzer.
   */
  const thinContent = pages
    .filter((page) => {
      if (
        page.statusCode &&
        (page.statusCode < 200 ||
          page.statusCode >= 300)
      ) {
        return false;
      }

      if (page.isIndexable === false) {
        return false;
      }

      return (page.wordCount ?? 0) < 300;
    })
    .map((page) => ({
      url: page.url,
      wordCount: page.wordCount ?? 0,
    }));

  if (thinContent.length > 0) {
    issues.push(
      createIssue(
        "content",
        "sitewide-thin-content",
        "warning",
        "Thin-content pages detected",
        `${thinContent.length} indexable pages contain fewer than 300 words.`,
        "Review these pages and add useful, original content where appropriate. Do not add unnecessary text simply to reach a word count.",
        thinContent.map((page) => page.url),
        3
      )
    );
  }

  /*
   * -----------------------------------------------------
   * CANONICAL CONFLICTS
   * -----------------------------------------------------
   */
  const canonicalConflicts: Array<{
    url: string;
    canonical: string;
  }> = [];

  for (const page of pages) {
    if (!page.canonicalUrl) {
      continue;
    }

    const pageUrl = normalizeUrl(
      page.finalUrl || page.url
    );

    const canonical = normalizeUrl(
      page.canonicalUrl
    );

    /*
     * Only flag cross-domain canonical targets here.
     * Self-vs-other-page canonicalization can be intentional.
     */
    try {
      const pageHost = new URL(pageUrl).hostname;
      const canonicalHost =
        new URL(canonical).hostname;

      if (pageHost !== canonicalHost) {
        canonicalConflicts.push({
          url: page.url,
          canonical: page.canonicalUrl,
        });
      }
    } catch {
      canonicalConflicts.push({
        url: page.url,
        canonical: page.canonicalUrl,
      });
    }
  }

  if (canonicalConflicts.length > 0) {
    issues.push(
      createIssue(
        "technical",
        "cross-domain-canonical",
        "error",
        "Cross-domain canonical conflicts detected",
        `${canonicalConflicts.length} pages point their canonical URL to another domain.`,
        "Verify that each cross-domain canonical is intentional. Otherwise, use a canonical URL on the same site.",
        canonicalConflicts.map(
          (item) => item.url
        ),
        5
      )
    );
  }

  /*
   * -----------------------------------------------------
   * REDIRECT CHAINS
   * -----------------------------------------------------
   */
  const redirectChains = pages
    .filter(
      (page) =>
        (page.redirectCount ?? 0) > 0
    )
    .map((page) => ({
      url: page.url,
      redirectCount:
        page.redirectCount ?? 0,
      chain: page.redirectChain ?? [],
    }));

  const longRedirectChains =
    redirectChains.filter(
      (item) => item.redirectCount > 1
    );

  if (longRedirectChains.length > 0) {
    issues.push(
      createIssue(
        "crawlability",
        "sitewide-redirect-chains",
        "warning",
        "Redirect chains detected",
        `${longRedirectChains.length} URLs require multiple redirects before reaching their final destination.`,
        "Update internal links to point directly to the final URL and reduce unnecessary redirect hops.",
        longRedirectChains.map(
          (item) => item.url
        ),
        3
      )
    );
  }

  /*
   * -----------------------------------------------------
   * ORPHAN PAGES
   * -----------------------------------------------------
   *
   * A page is considered an orphan when no other crawled
   * internal page links to it.
   *
   * The homepage/root URL is excluded.
   */
  const crawledUrls = new Map<
    string,
    string
  >();

  for (const page of pages) {
    crawledUrls.set(
      normalizeUrl(
        page.finalUrl || page.url
      ),
      page.url
    );

    crawledUrls.set(
      normalizeUrl(page.url),
      page.url
    );
  }

  const linkedTargets = new Set<string>();

  for (const link of links) {
    if (!link.isInternal) {
      continue;
    }

    linkedTargets.add(
      normalizeUrl(link.normalizedTargetUrl)
    );
  }

  const orphanPageList = pages
    .filter((page) => {
      const normalized = normalizeUrl(
        page.finalUrl || page.url
      );

      const pathname = (() => {
        try {
          return new URL(
            page.finalUrl || page.url
          ).pathname;
        } catch {
          return "";
        }
      })();

      /*
       * The root/home page is not considered orphaned.
       */
      if (
        pathname === "/" ||
        pathname === ""
      ) {
        return false;
      }

      return !linkedTargets.has(normalized);
    })
    .map((page) => page.url);

  if (orphanPageList.length > 0) {
    issues.push(
      createIssue(
        "crawlability",
        "orphan-page",
        "warning",
        "Orphan pages detected",
        `${orphanPageList.length} crawled pages have no internal links pointing to them.`,
        "Add relevant internal links from important pages so users and search engines can discover these URLs.",
        orphanPageList,
        4
      )
    );
  }

  /*
   * -----------------------------------------------------
   * BROKEN INTERNAL LINKS
   * -----------------------------------------------------
   */
  const brokenLinks = links
    .filter(
      (link) =>
        link.isInternal &&
        link.isBroken
    )
    .map((link) => ({
      sourceUrl: link.sourceUrl,
      targetUrl: link.targetUrl,
      statusCode:
        link.targetStatusCode ?? null,
    }));

  if (brokenLinks.length > 0) {
    issues.push(
      createIssue(
        "links",
        "broken-internal-link",
        "error",
        "Broken internal links detected",
        `${brokenLinks.length} internal links point to unavailable URLs.`,
        "Fix, remove, or redirect broken internal links to the correct destination.",
        [
          ...new Set(
            brokenLinks.map(
              (link) => link.sourceUrl
            )
          ),
        ],
        5
      )
    );
  }

  /*
   * -----------------------------------------------------
   * ISSUE PRIORITY
   * -----------------------------------------------------
   */
  const priorityIssues = [...issues]
    .sort((a, b) => {
      const priorityDifference =
        PRIORITY_ORDER[b.priority] -
        PRIORITY_ORDER[a.priority];

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return (
        SEVERITY_ORDER[b.severity] -
        SEVERITY_ORDER[a.severity]
      );
    })
    .slice(0, 15);

  /*
   * -----------------------------------------------------
   * SCORE
   * -----------------------------------------------------
   */
  const score = calculateSitewideScore(
    pages,
    issues.length,
    duplicateTitleGroups.length,
    duplicateMetaGroups.length,
    thinContent.length,
    orphanPageList.length,
    brokenLinks.length,
    canonicalConflicts.length,
    longRedirectChains.length
  );

  return {
    score,

    pagesAnalyzed: pages.length,

    duplicateTitles:
      duplicateTitleGroups.length,

    duplicateMetaDescriptions:
      duplicateMetaGroups.length,

    thinContentPages:
      thinContent.length,

    orphanPages:
      orphanPageList.length,

    brokenInternalLinks:
      brokenLinks.length,

    canonicalConflicts:
      canonicalConflicts.length,

    redirectChains:
      longRedirectChains.length,

    issues,

    priorityIssues,

    duplicateTitleGroups,

    duplicateMetaGroups,

    thinContent,

    orphanPageList,

    brokenLinks,

    canonicalConflicts,

    redirectChains: longRedirectChains,
  };
}