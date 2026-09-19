import * as cheerio from "cheerio";

/* =========================================================
   CONFIGURATION
========================================================= */

const MAX_HTML_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;

/**
 * Backward-compatible default.
 *
 * Subscription plans should always pass their own
 * `pagesPerAudit` value to crawlWebsite().
 */
export const DEFAULT_MAX_PAGES = 20;
export const DEFAULT_MAX_DEPTH = 10;

/**
 * Absolute safety ceiling for a single crawler run.
 *
 * This prevents an accidentally corrupted plan value
 * from creating an unreasonable crawl.
 */
export const MAX_ALLOWED_CRAWL_PAGES = 10_000;

/**
 * Maximum number of sitemap files that can be processed
 * during a single crawl.
 */
const MAX_SITEMAPS = 100;

/**
 * Maximum sitemap page candidates that can be collected.
 *
 * This is intentionally larger than the actual page limit
 * because some discovered URLs may be:
 *
 * - blocked by robots.txt
 * - invalid
 * - duplicates
 * - unavailable
 * - non-HTML
 * - redirected
 * - failed during crawling
 *
 * The crawler will STILL never return more than
 * `pageLimit` crawled pages.
 */
const MAX_SITEMAP_URLS = 50_000;

const CRAWLER_USER_AGENT = "SEO-Auditor";

/* =========================================================
   TYPES
========================================================= */

export type RedirectHop = {
  url: string;
  statusCode: number;
  responseTimeMs: number;
};

export type CrawledPage = {
  /**
   * Original URL that was queued/discovered.
   */
  url: string;

  /**
   * Final URL after following redirects.
   */
  finalUrl: string;

  /**
   * Final HTTP response status.
   */
  statusCode: number;

  /**
   * Final response content type.
   */
  contentType: string;

  /**
   * HTML returned by the final response.
   *
   * Empty for non-HTML responses.
   */
  html: string;

  /**
   * Total time required to complete the
   * complete request + redirect chain.
   */
  responseTimeMs: number;

  /**
   * Number of redirects before the final response.
   */
  redirectCount: number;

  /**
   * Complete redirect chain.
   */
  redirectChain: RedirectHop[];

  /**
   * Crawl depth.
   */
  depth: number;
};

export type CrawlResult = {
  pages: CrawledPage[];
  robotsTxt: string | null;
  sitemapUrls: string[];
};

type QueueItem = {
  url: string;
  depth: number;
};

/* =========================================================
   URL NORMALIZATION
========================================================= */

/**
 * Tracking parameters that do not normally represent
 * meaningful page variations.
 */
const TRACKING_PARAMETERS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "dclid",
  "fbclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "_ga",
]);

/**
 * Normalize a URL for crawling.
 *
 * We intentionally DO NOT remove normal query parameters
 * such as:
 *
 * ?category=jobs
 * ?page=2
 * ?location=abuja
 *
 * because they may represent real page variations.
 */
export function normalizeUrl(
  input: string
): string {
  try {
    const url =
      new URL(
        input.trim()
      );

    url.hash = "";

    const entries =
      Array.from(
        url.searchParams.entries()
      );

    url.search = "";

    const retained =
      entries
        .filter(
          ([key]) =>
            !TRACKING_PARAMETERS.has(
              key.toLowerCase()
            )
        )
        .sort(
          (
            [keyA, valueA],
            [keyB, valueB]
          ) => {
            const keyCompare =
              keyA.localeCompare(
                keyB
              );

            if (
              keyCompare !== 0
            ) {
              return keyCompare;
            }

            return valueA.localeCompare(
              valueB
            );
          }
        );

    for (
      const [key, value] of
        retained
    ) {
      url.searchParams.append(
        key,
        value
      );
    }

    if (
      (
        url.protocol ===
          "http:" ||
        url.protocol ===
          "https:"
      ) &&
      url.pathname !== "/" &&
      url.pathname.endsWith("/")
    ) {
      url.pathname =
        url.pathname.replace(
          /\/+$/,
          ""
        );
    }

    return url.toString();
  } catch {
    return input.trim();
  }
}

/**
 * Returns whether a URL is the same crawl identity.
 *
 * Query-string variations are intentionally preserved.
 */
export function getCrawlIdentity(
  input: string
): string {
  return normalizeUrl(
    input
  );
}

/**
 * Query collapsing is intentionally informational for now.
 *
 * Meaningful filters and pagination remain crawlable.
 */
export function shouldCollapseQueryUrl(
  _input: string
): boolean {
  return false;
}

/* =========================================================
   NETWORK SECURITY
========================================================= */

/**
 * Detect private/reserved IPv4 ranges.
 */
function isPrivateIpv4(
  hostname: string
): boolean {
  const parts =
    hostname
      .split(".")
      .map(Number);

  if (
    parts.length !== 4 ||
    parts.some(
      (part) =>
        !Number.isInteger(
          part
        ) ||
        part < 0 ||
        part > 255
    )
  ) {
    return false;
  }

  const [
    a,
    b,
  ] = parts;

  /**
   * 10.0.0.0/8
   */
  if (
    a === 10
  ) {
    return true;
  }

  /**
   * 172.16.0.0/12
   */
  if (
    a === 172 &&
    b >= 16 &&
    b <= 31
  ) {
    return true;
  }

  /**
   * 192.168.0.0/16
   */
  if (
    a === 192 &&
    b === 168
  ) {
    return true;
  }

  /**
   * 127.0.0.0/8
   */
  if (
    a === 127
  ) {
    return true;
  }

  /**
   * 169.254.0.0/16
   */
  if (
    a === 169 &&
    b === 254
  ) {
    return true;
  }

  /**
   * 0.0.0.0/8
   */
  if (
    a === 0
  ) {
    return true;
  }

  return false;
}

function isUnsafeHostname(
  hostname: string
): boolean {
  const normalized =
    hostname
      .toLowerCase()
      .replace(
        /\.$/,
        ""
      );

  if (
    normalized ===
      "localhost" ||
    normalized ===
      "localhost.localdomain" ||
    normalized ===
      "::1" ||
    normalized.endsWith(
      ".local"
    )
  ) {
    return true;
  }

  if (
    normalized ===
      "127.0.0.1" ||
    normalized ===
      "0.0.0.0"
  ) {
    return true;
  }

  if (
    isPrivateIpv4(
      normalized
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Validate that a URL uses HTTP(S) and does not
 * explicitly target a private/local hostname.
 */
function assertSafeUrl(
  input: string
): URL {
  let url: URL;

  try {
    url =
      new URL(
        input
      );
  } catch {
    throw new Error(
      `Invalid URL: ${input}`
    );
  }

  if (
    url.protocol !==
      "http:" &&
    url.protocol !==
      "https:"
  ) {
    throw new Error(
      `Unsupported protocol: ${url.protocol}`
    );
  }

  if (
    isUnsafeHostname(
      url.hostname
    )
  ) {
    throw new Error(
      `Blocked unsafe hostname: ${url.hostname}`
    );
  }

  return url;
}

/* =========================================================
   DOMAIN HELPERS
========================================================= */

/**
 * Normalize hostnames so www.example.com and
 * example.com are treated as the same crawl domain.
 */
function normalizeHostname(
  hostname: string
): string {
  return hostname
    .toLowerCase()
    .replace(
      /^www\./,
      ""
    );
}

/**
 * Determine whether two URLs belong to the same
 * normalized hostname.
 */
function isSameDomain(
  urlA: string,
  urlB: string
): boolean {
  try {
    const hostA =
      normalizeHostname(
        new URL(
          urlA
        ).hostname
      );

    const hostB =
      normalizeHostname(
        new URL(
          urlB
        ).hostname
      );

    return (
      hostA === hostB
    );
  } catch {
    return false;
  }
}

/* =========================================================
   CRAWL LIMIT HELPERS
========================================================= */

/**
 * Normalize the requested per-audit page limit.
 *
 * Guarantees:
 *
 * - finite number
 * - integer
 * - at least 1
 * - never greater than MAX_ALLOWED_CRAWL_PAGES
 */
function normalizeMaxPages(
  value: number
): number {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return DEFAULT_MAX_PAGES;
  }

  const normalized =
    Math.floor(
      value
    );

  if (
    normalized <= 0
  ) {
    return 1;
  }

  return Math.min(
    normalized,
    MAX_ALLOWED_CRAWL_PAGES
  );
}

/**
 * Normalize maximum crawl depth.
 */
function normalizeMaxDepth(
  value: number
): number {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return DEFAULT_MAX_DEPTH;
  }

  const normalized =
    Math.floor(
      value
    );

  if (
    normalized < 0
  ) {
    return 0;
  }

  return normalized;
}

/* =========================================================
   FETCH HELPERS
========================================================= */

function getContentType(
  response: Response
): string {
  return (
    response.headers.get(
      "content-type"
    ) || ""
  );
}

function isHtmlContentType(
  contentType: string
): boolean {
  const normalized =
    contentType.toLowerCase();

  return (
    normalized.includes(
      "text/html"
    ) ||
    normalized.includes(
      "application/xhtml+xml"
    )
  );
}

/**
 * Read a response body while enforcing a hard
 * byte limit.
 */
async function readResponseBody(
  response: Response,
  maxBytes: number
): Promise<string> {
  if (
    !response.body
  ) {
    return "";
  }

  const reader =
    response.body.getReader();

  const chunks:
    Uint8Array[] =
    [];

  let totalBytes =
    0;

  try {
    while (true) {
      const {
        value,
        done,
      } =
        await reader.read();

      if (
        done
      ) {
        break;
      }

      if (
        !value
      ) {
        continue;
      }

      totalBytes +=
        value.byteLength;

      if (
        totalBytes >
        maxBytes
      ) {
        await reader.cancel();

        throw new Error(
          `Response exceeded the ${maxBytes} byte limit.`
        );
      }

      chunks.push(
        value
      );
    }
  } finally {
    reader.releaseLock();
  }

  const combined =
    new Uint8Array(
      totalBytes
    );

  let offset =
    0;

  for (
    const chunk of
      chunks
  ) {
    combined.set(
      chunk,
      offset
    );

    offset +=
      chunk.byteLength;
  }

  return new TextDecoder(
    "utf-8"
  ).decode(
    combined
  );
}

/**
 * Create a fetch timeout signal.
 */
function createRequestController(): {
  controller: AbortController;
  timeout: ReturnType<typeof setTimeout>;
} {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => {
        controller.abort();
      },
      REQUEST_TIMEOUT_MS
    );

  return {
    controller,
    timeout,
  };
}

/**
 * Determine whether an HTTP status is a redirect.
 */
function isRedirectStatus(
  status: number
): boolean {
  return (
    status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308
  );
}

/* =========================================================
   PAGE FETCHING
========================================================= */

/**
 * Fetch a page manually following redirects.
 *
 * Manual redirect handling allows us to enforce:
 *
 * - same-domain redirects
 * - safe redirect targets
 * - redirect limits
 * - redirect loops
 * - redirect timing
 * - final URL tracking
 */
export async function fetchPage(
  inputUrl: string
): Promise<CrawledPage> {
  const originalUrl =
    normalizeUrl(
      inputUrl
    );

  const originalUrlObject =
    assertSafeUrl(
      originalUrl
    );

  const originalHostname =
    normalizeHostname(
      originalUrlObject.hostname
    );

  let currentUrl =
    originalUrl;

  const redirectChain:
    RedirectHop[] =
    [];

  const visitedRedirectUrls =
    new Set<string>();

  const totalStartedAt =
    Date.now();

  for (
    let redirectDepth = 0;
    redirectDepth <=
    MAX_REDIRECTS;
    redirectDepth++
  ) {
    const normalizedCurrentUrl =
      normalizeUrl(
        currentUrl
      );

    const currentUrlObject =
      assertSafeUrl(
        normalizedCurrentUrl
      );

    const currentHostname =
      normalizeHostname(
        currentUrlObject.hostname
      );

    /**
     * Never allow a redirect to leave
     * the original crawl hostname.
     */
    if (
      currentHostname !==
      originalHostname
    ) {
      throw new Error(
        `Redirect moved outside the crawl domain: ${normalizedCurrentUrl}`
      );
    }

    const crawlIdentity =
      getCrawlIdentity(
        normalizedCurrentUrl
      );

    /**
     * Prevent redirect loops.
     */
    if (
      visitedRedirectUrls.has(
        crawlIdentity
      )
    ) {
      throw new Error(
        `Redirect loop detected at ${normalizedCurrentUrl}`
      );
    }

    visitedRedirectUrls.add(
      crawlIdentity
    );

    const hopStartedAt =
      Date.now();

    const {
      controller,
      timeout,
    } =
      createRequestController();

    let response: Response;

    try {
      response =
        await fetch(
          normalizedCurrentUrl,
          {
            method:
              "GET",

            headers: {
              "User-Agent":
                CRAWLER_USER_AGENT,

              Accept:
                "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
            },

            redirect:
              "manual",

            signal:
              controller.signal,

            cache:
              "no-store",
          }
        );
    } catch (
      error
    ) {
      if (
        error instanceof
          DOMException &&
        error.name ===
          "AbortError"
      ) {
        throw new Error(
          `Request timed out after ${REQUEST_TIMEOUT_MS}ms: ${normalizedCurrentUrl}`
        );
      }

      if (
        error instanceof
          Error &&
        error.name ===
          "AbortError"
      ) {
        throw new Error(
          `Request timed out after ${REQUEST_TIMEOUT_MS}ms: ${normalizedCurrentUrl}`
        );
      }

      throw error;
    } finally {
      clearTimeout(
        timeout
      );
    }

    const hopResponseTimeMs =
      Date.now() -
      hopStartedAt;

    redirectChain.push({
      url:
        normalizedCurrentUrl,

      statusCode:
        response.status,

      responseTimeMs:
        hopResponseTimeMs,
    });

    if (
      isRedirectStatus(
        response.status
      )
    ) {
      const location =
        response.headers.get(
          "location"
        );

      /**
       * A redirect without a Location header
       * is treated as the final response.
       */
      if (
        !location
      ) {
        return {
          url:
            originalUrl,

          finalUrl:
            normalizedCurrentUrl,

          statusCode:
            response.status,

          contentType:
            getContentType(
              response
            ),

          html:
            "",

          responseTimeMs:
            Date.now() -
            totalStartedAt,

          redirectCount:
            Math.max(
              0,
              redirectChain.length -
                1
            ),

          redirectChain,

          depth:
            0,
        };
      }

      let nextUrl: URL;

      try {
        nextUrl =
          new URL(
            location,
            normalizedCurrentUrl
          );
      } catch {
        throw new Error(
          `Invalid redirect location from ${normalizedCurrentUrl}: ${location}`
        );
      }

      /**
       * Validate protocol and hostname
       * before following the redirect.
       */
      assertSafeUrl(
        nextUrl.toString()
      );

      const nextHostname =
        normalizeHostname(
          nextUrl.hostname
        );

      if (
        nextHostname !==
        originalHostname
      ) {
        throw new Error(
          `Redirect target is outside the crawl domain: ${nextUrl.toString()}`
        );
      }

      if (
        redirectDepth >=
        MAX_REDIRECTS
      ) {
        throw new Error(
          `Maximum redirect limit of ${MAX_REDIRECTS} exceeded for ${originalUrl}`
        );
      }

      currentUrl =
        normalizeUrl(
          nextUrl.toString()
        );

      continue;
    }

    const finalUrl =
      normalizedCurrentUrl;

    const contentType =
      getContentType(
        response
      );

    /**
     * Non-HTML responses are still recorded as
     * crawled pages so the audit can inspect things
     * such as status codes and content types.
     */
    if (
      !isHtmlContentType(
        contentType
      )
    ) {
      return {
        url:
          originalUrl,

        finalUrl,

        statusCode:
          response.status,

        contentType,

        html:
          "",

        responseTimeMs:
          Date.now() -
          totalStartedAt,

        redirectCount:
          Math.max(
            0,
            redirectChain.length -
              1
          ),

        redirectChain,

        depth:
          0,
      };
    }

    const html =
      await readResponseBody(
        response,
        MAX_HTML_BYTES
      );

    return {
      url:
        originalUrl,

      finalUrl,

      statusCode:
        response.status,

      contentType,

      html,

      responseTimeMs:
        Date.now() -
        totalStartedAt,

      redirectCount:
        Math.max(
          0,
          redirectChain.length -
            1
        ),

      redirectChain,

      depth:
        0,
    };
  }

  throw new Error(
    `Unable to resolve ${originalUrl}`
  );
}

/* =========================================================
   ROBOTS.TXT
========================================================= */

type RobotsRule = {
  pattern: string;
  allow: boolean;
};

type RobotsGroup = {
  userAgents: string[];
  rules: RobotsRule[];
};

function parseRobotsTxt(
  robotsTxt: string
): RobotsGroup[] {
  const groups:
    RobotsGroup[] =
    [];

  let currentGroup:
    | RobotsGroup
    | null =
    null;

  const lines =
    robotsTxt.split(
      /\r?\n/
    );

  for (
    const rawLine of
      lines
  ) {
    const line =
      rawLine
        .replace(
          /#.*/,
          ""
        )
        .trim();

    if (
      !line
    ) {
      continue;
    }

    const separator =
      line.indexOf(
        ":"
      );

    if (
      separator ===
      -1
    ) {
      continue;
    }

    const field =
      line
        .slice(
          0,
          separator
        )
        .trim()
        .toLowerCase();

    const value =
      line
        .slice(
          separator + 1
        )
        .trim();

    if (
      field ===
      "user-agent"
    ) {
      const userAgent =
        value.toLowerCase();

      if (
        !currentGroup ||
        currentGroup.rules.length >
          0
      ) {
        currentGroup =
          {
            userAgents:
              [],

            rules:
              [],
          };

        groups.push(
          currentGroup
        );
      }

      currentGroup.userAgents.push(
        userAgent
      );

      continue;
    }

    if (
      field ===
        "allow" ||
      field ===
        "disallow"
    ) {
      if (
        !currentGroup
      ) {
        continue;
      }

      if (
        !value &&
        field ===
          "disallow"
      ) {
        continue;
      }

      currentGroup.rules.push(
        {
          pattern:
            value,

          allow:
            field ===
            "allow",
        }
      );
    }
  }

  return groups;
}

function robotsPatternMatches(
  pathname: string,
  pattern: string
): boolean {
  if (
    !pattern
  ) {
    return false;
  }

  let escaped =
    pattern.replace(
      /[.+?^${}()|[\]\\]/g,
      "\\$&"
    );

  escaped =
    escaped.replace(
      /\*/g,
      ".*"
    );

  /**
   * Robots.txt `$` means the end of the URL path.
   */
  if (
    pattern.endsWith(
      "$"
    )
  ) {
    escaped =
      escaped.slice(
        0,
        -2
      ) + "$";
  }

  try {
    return new RegExp(
      `^${escaped}`,
      "i"
    ).test(
      pathname
    );
  } catch {
    return pathname.startsWith(
      pattern
    );
  }
}

function isAllowedByRobots(
  url: string,
  robotsTxt: string | null
): boolean {
  if (
    !robotsTxt
  ) {
    return true;
  }

  const groups =
    parseRobotsTxt(
      robotsTxt
    );

  if (
    !groups.length
  ) {
    return true;
  }

  const crawlerAgent =
    CRAWLER_USER_AGENT.toLowerCase();

  const applicableGroups =
    groups.filter(
      (group) =>
        group.userAgents.includes(
          "*"
        ) ||
        group.userAgents.some(
          (agent) =>
            agent &&
            crawlerAgent.includes(
              agent
            )
        )
    );

  if (
    !applicableGroups.length
  ) {
    return true;
  }

  let pathname =
    "/";

  try {
    pathname =
      new URL(
        url
      ).pathname;
  } catch {
    return true;
  }

  const rules =
    applicableGroups.flatMap(
      (group) =>
        group.rules
    );

  let matchedRule:
    | RobotsRule
    | null =
    null;

  for (
    const rule of
      rules
  ) {
    if (
      robotsPatternMatches(
        pathname,
        rule.pattern
      )
    ) {
      /**
       * Longest matching rule wins.
       *
       * If two rules have the same length,
       * Allow wins, matching common robots.txt
       * crawler behavior.
       */
      if (
        !matchedRule ||
        rule.pattern.length >
          matchedRule.pattern.length ||
        (
          rule.pattern.length ===
            matchedRule.pattern.length &&
          rule.allow &&
          !matchedRule.allow
        )
      ) {
        matchedRule =
          rule;
      }
    }
  }

  if (
    !matchedRule
  ) {
    return true;
  }

  return matchedRule.allow;
}

/**
 * Fetch robots.txt while preventing cross-domain
 * redirects.
 */
async function fetchRobotsTxt(
  baseUrl: string
): Promise<string | null> {
  try {
    const base =
      assertSafeUrl(
        baseUrl
      );

    const originalHostname =
      normalizeHostname(
        base.hostname
      );

    const robotsUrl =
      new URL(
        base.toString()
      );

    robotsUrl.pathname =
      "/robots.txt";

    robotsUrl.search =
      "";

    robotsUrl.hash =
      "";

    let currentUrl =
      normalizeUrl(
        robotsUrl.toString()
      );

    const visited =
      new Set<string>();

    for (
      let redirectDepth = 0;
      redirectDepth <=
      MAX_REDIRECTS;
      redirectDepth++
    ) {
      const normalized =
        normalizeUrl(
          currentUrl
        );

      const parsed =
        assertSafeUrl(
          normalized
        );

      if (
        normalizeHostname(
          parsed.hostname
        ) !==
        originalHostname
      ) {
        return null;
      }

      if (
        visited.has(
          normalized
        )
      ) {
        return null;
      }

      visited.add(
        normalized
      );

      const {
        controller,
        timeout,
      } =
        createRequestController();

      let response: Response;

      try {
        response =
          await fetch(
            normalized,
            {
              method:
                "GET",

              headers: {
                "User-Agent":
                  CRAWLER_USER_AGENT,
              },

              redirect:
                "manual",

              signal:
                controller.signal,

              cache:
                "no-store",
            }
          );
      } catch {
        return null;
      } finally {
        clearTimeout(
          timeout
        );
      }

      if (
        isRedirectStatus(
          response.status
        )
      ) {
        const location =
          response.headers.get(
            "location"
          );

        if (
          !location
        ) {
          return null;
        }

        let nextUrl: URL;

        try {
          nextUrl =
            new URL(
              location,
              normalized
            );
        } catch {
          return null;
        }

        try {
          assertSafeUrl(
            nextUrl.toString()
          );
        } catch {
          return null;
        }

        if (
          normalizeHostname(
            nextUrl.hostname
          ) !==
          originalHostname
        ) {
          return null;
        }

        if (
          redirectDepth >=
          MAX_REDIRECTS
        ) {
          return null;
        }

        currentUrl =
          normalizeUrl(
            nextUrl.toString()
          );

        continue;
      }

      if (
        !response.ok
      ) {
        return null;
      }

      return await readResponseBody(
        response,
        MAX_TEXT_BYTES
      );
    }

    return null;
  } catch {
    return null;
  }
}

/* =========================================================
   SITEMAPS
========================================================= */

function extractSitemapLocations(
  robotsTxt: string | null
): string[] {
  if (
    !robotsTxt
  ) {
    return [];
  }

  return robotsTxt
    .split(
      /\r?\n/
    )
    .map(
      (line) =>
        line.trim()
    )
    .filter(
      (line) =>
        /^sitemap\s*:/i.test(
          line
        )
    )
    .map(
      (line) =>
        line
          .replace(
            /^sitemap\s*:/i,
            ""
          )
          .trim()
    )
    .filter(
      Boolean
    );
}

/**
 * Fetch a sitemap while preventing unsafe or
 * cross-domain redirects.
 */
async function fetchSitemap(
  sitemapUrl: string
): Promise<{
  urls: string[];
  childSitemaps: string[];
}> {
  try {
    const originalUrl =
      normalizeUrl(
        sitemapUrl
      );

    const original =
      assertSafeUrl(
        originalUrl
      );

    const originalHostname =
      normalizeHostname(
        original.hostname
      );

    let currentUrl =
      originalUrl;

    const visited =
      new Set<string>();

    for (
      let redirectDepth = 0;
      redirectDepth <=
      MAX_REDIRECTS;
      redirectDepth++
    ) {
      const normalized =
        normalizeUrl(
          currentUrl
        );

      const parsed =
        assertSafeUrl(
          normalized
        );

      if (
        normalizeHostname(
          parsed.hostname
        ) !==
        originalHostname
      ) {
        return {
          urls:
            [],

          childSitemaps:
            [],
        };
      }

      if (
        visited.has(
          normalized
        )
      ) {
        return {
          urls:
            [],

          childSitemaps:
            [],
        };
      }

      visited.add(
        normalized
      );

      const {
        controller,
        timeout,
      } =
        createRequestController();

      let response: Response;

      try {
        response =
          await fetch(
            normalized,
            {
              method:
                "GET",

              headers: {
                "User-Agent":
                  CRAWLER_USER_AGENT,

                Accept:
                  "application/xml,text/xml;q=0.9,*/*;q=0.8",
              },

              redirect:
                "manual",

              signal:
                controller.signal,

              cache:
                "no-store",
            }
          );
      } catch {
        return {
          urls:
            [],

          childSitemaps:
            [],
        };
      } finally {
        clearTimeout(
          timeout
        );
      }

      if (
        isRedirectStatus(
          response.status
        )
      ) {
        const location =
          response.headers.get(
            "location"
          );

        if (
          !location
        ) {
          return {
            urls:
              [],

            childSitemaps:
              [],
          };
        }

        let nextUrl: URL;

        try {
          nextUrl =
            new URL(
              location,
              normalized
            );
        } catch {
          return {
            urls:
              [],

            childSitemaps:
              [],
          };
        }

        try {
          assertSafeUrl(
            nextUrl.toString()
          );
        } catch {
          return {
            urls:
              [],

            childSitemaps:
              [],
          };
        }

        if (
          normalizeHostname(
            nextUrl.hostname
          ) !==
          originalHostname
        ) {
          return {
            urls:
              [],

            childSitemaps:
              [],
          };
        }

        if (
          redirectDepth >=
          MAX_REDIRECTS
        ) {
          return {
            urls:
              [],

            childSitemaps:
              [],
          };
        }

        currentUrl =
          normalizeUrl(
            nextUrl.toString()
          );

        continue;
      }

      if (
        !response.ok
      ) {
        return {
          urls:
            [],

          childSitemaps:
            [],
        };
      }

      const text =
        await readResponseBody(
          response,
          MAX_TEXT_BYTES
        );

      const $ =
        cheerio.load(
          text,
          {
            xmlMode:
              true,
          }
        );

      const urls:
        string[] =
        [];

      const childSitemaps:
        string[] =
        [];

      $("url loc").each(
        (
          _,
          element
        ) => {
          const value =
            $(element)
              .text()
              .trim();

          if (
            value
          ) {
            urls.push(
              value
            );
          }
        }
      );

      $("sitemap loc").each(
        (
          _,
          element
        ) => {
          const value =
            $(element)
              .text()
              .trim();

          if (
            value
          ) {
            childSitemaps.push(
              value
            );
          }
        }
      );

      return {
        urls,
        childSitemaps,
      };
    }

    return {
      urls:
        [],

      childSitemaps:
        [],
    };
  } catch {
    return {
      urls:
        [],

      childSitemaps:
        [],
    };
  }
}

/**
 * Discover sitemap files and collect page candidates.
 *
 * `maxPageCandidates` limits how many page URLs are
 * retained from sitemaps. It does NOT change the actual
 * crawl page limit.
 */
async function discoverSitemaps(
  baseUrl: string,
  robotsTxt: string | null,
  maxPageCandidates: number
): Promise<{
  sitemapUrls: string[];
  discoveredPageUrls: string[];
}> {
  const candidateLimit =
    Math.min(
      MAX_SITEMAP_URLS,
      Math.max(
        1,
        Math.floor(
          maxPageCandidates
        )
      )
    );

  const discoveredSitemapUrls =
    new Set<string>();

  const discoveredPageUrls =
    new Set<string>();

  const queue:
    string[] =
    [];

  const queuedSitemaps =
    new Set<string>();

  const robotsSitemaps =
    extractSitemapLocations(
      robotsTxt
    );

  /**
   * Add sitemap candidates without duplicates.
   */
  function enqueueSitemap(
    sitemapUrl: string
  ) {
    try {
      const normalized =
        normalizeUrl(
          sitemapUrl
        );

      const parsed =
        assertSafeUrl(
          normalized
        );

      if (
        !isSameDomain(
          normalized,
          baseUrl
        )
      ) {
        return;
      }

      if (
        queuedSitemaps.has(
          normalized
        ) ||
        discoveredSitemapUrls.has(
          normalized
        )
      ) {
        return;
      }

      /**
       * Do not allow more than MAX_SITEMAPS
       * total sitemap candidates to accumulate.
       */
      if (
        queuedSitemaps.size +
          discoveredSitemapUrls.size >=
        MAX_SITEMAPS
      ) {
        return;
      }

      /**
       * Prevent unused variable warnings while
       * still forcing URL validation.
       */
      void parsed;

      queuedSitemaps.add(
        normalized
      );

      queue.push(
        normalized
      );
    } catch {
      // Ignore malformed or unsafe sitemap URLs.
    }
  }

  /**
   * Sitemaps explicitly declared by robots.txt
   * receive priority.
   */
  for (
    const sitemap of
      robotsSitemaps
  ) {
    enqueueSitemap(
      new URL(
        sitemap,
        baseUrl
      ).toString()
    );
  }

  /**
   * If robots.txt did not provide a sitemap,
   * use the conventional /sitemap.xml location.
   */
  if (
    queue.length ===
    0
  ) {
    try {
      const fallback =
        new URL(
          "/sitemap.xml",
          baseUrl
        ).toString();

      enqueueSitemap(
        fallback
      );
    } catch {
      // Ignore malformed fallback URL.
    }
  }

  while (
    queue.length > 0 &&
    discoveredSitemapUrls.size <
      MAX_SITEMAPS &&
    discoveredPageUrls.size <
      candidateLimit
  ) {
    const sitemapUrl =
      queue.shift();

    if (
      !sitemapUrl
    ) {
      continue;
    }

    queuedSitemaps.delete(
      sitemapUrl
    );

    if (
      discoveredSitemapUrls.has(
        sitemapUrl
      )
    ) {
      continue;
    }

    discoveredSitemapUrls.add(
      sitemapUrl
    );

    const result =
      await fetchSitemap(
        sitemapUrl
      );

    /**
     * Collect page URLs until the candidate
     * discovery limit is reached.
     */
    for (
      const pageUrl of
        result.urls
    ) {
      if (
        discoveredPageUrls.size >=
        candidateLimit
      ) {
        break;
      }

      try {
        const absolute =
          new URL(
            pageUrl,
            baseUrl
          ).toString();

        const normalized =
          normalizeUrl(
            absolute
          );

        /**
         * Validate the URL before retaining it.
         */
        assertSafeUrl(
          normalized
        );

        if (
          !isSameDomain(
            normalized,
            baseUrl
          )
        ) {
          continue;
        }

        discoveredPageUrls.add(
          normalized
        );
      } catch {
        // Ignore malformed, unsafe, or external URLs.
      }
    }

    /**
     * Continue discovering child sitemaps
     * if page candidate capacity remains.
     */
    if (
      discoveredPageUrls.size <
      candidateLimit
    ) {
      for (
        const child of
          result.childSitemaps
      ) {
        if (
          discoveredSitemapUrls.size +
            queue.length >=
          MAX_SITEMAPS
        ) {
          break;
        }

        enqueueSitemap(
          new URL(
            child,
            sitemapUrl
          ).toString()
        );
      }
    }
  }

  return {
    sitemapUrls:
      Array.from(
        discoveredSitemapUrls
      ),

    discoveredPageUrls:
      Array.from(
        discoveredPageUrls
      ),
  };
}

/* =========================================================
   LINK EXTRACTION
========================================================= */

function extractLinks(
  html: string,
  pageUrl: string
): string[] {
  const $ =
    cheerio.load(
      html
    );

  const links =
    new Set<string>();

  $("a[href]").each(
    (
      _,
      element
    ) => {
      const href =
        $(element)
          .attr(
            "href"
          )
          ?.trim();

      if (
        !href
      ) {
        return;
      }

      const lowerHref =
        href.toLowerCase();

      /**
       * Ignore non-web links.
       */
      if (
        href.startsWith(
          "#"
        ) ||
        lowerHref.startsWith(
          "mailto:"
        ) ||
        lowerHref.startsWith(
          "tel:"
        ) ||
        lowerHref.startsWith(
          "javascript:"
        ) ||
        lowerHref.startsWith(
          "data:"
        )
      ) {
        return;
      }

      try {
        const absolute =
          new URL(
            href,
            pageUrl
          );

        if (
          absolute.protocol !==
            "http:" &&
          absolute.protocol !==
            "https:"
        ) {
          return;
        }

        links.add(
          normalizeUrl(
            absolute.toString()
          )
        );
      } catch {
        // Ignore malformed links.
      }
    }
  );

  return Array.from(
    links
  );
}

/* =========================================================
   MAIN CRAWLER
========================================================= */

/**
 * Crawl a website while enforcing a hard per-audit
 * page limit.
 *
 * IMPORTANT:
 *
 * `maxPages` is the active subscription plan's
 * `pagesPerAudit` value.
 *
 * It is NOT the subscription-period `pagesCrawled`
 * usage counter.
 *
 * The crawler will never intentionally return more
 * than `maxPages` pages.
 */
export async function crawlWebsite(
  startUrl: string,
  maxPages:
    number = DEFAULT_MAX_PAGES,
  maxDepth:
    number = DEFAULT_MAX_DEPTH
): Promise<CrawlResult> {
  /**
   * Normalize the page limit before doing any
   * network work.
   */
  const pageLimit =
    normalizeMaxPages(
      maxPages
    );

  /**
   * Normalize crawl depth.
   */
  const depthLimit =
    normalizeMaxDepth(
      maxDepth
    );

  /**
   * Normalize and validate the starting URL.
   */
  const normalizedStartUrl =
    normalizeUrl(
      startUrl
    );

  const startUrlObject =
    assertSafeUrl(
      normalizedStartUrl
    );

  const baseHostname =
    normalizeHostname(
      startUrlObject.hostname
    );

  /* -------------------------------------------------------
     ROBOTS.TXT
  ------------------------------------------------------- */

  const robotsTxt =
    await fetchRobotsTxt(
      normalizedStartUrl
    );

  /* -------------------------------------------------------
     SITEMAPS
  ------------------------------------------------------- */

  /**
   * Sitemap discovery is bounded independently from
   * the actual crawl page count.
   *
   * The crawler may discover candidates beyond the
   * page limit, but it can never crawl beyond it.
   */
  const sitemapCandidateLimit =
    Math.min(
      MAX_SITEMAP_URLS,
      Math.max(
        pageLimit * 5,
        pageLimit
      )
    );

  const sitemapResult =
    await discoverSitemaps(
      normalizedStartUrl,
      robotsTxt,
      sitemapCandidateLimit
    );

  /* -------------------------------------------------------
     CRAWL STATE
  ------------------------------------------------------- */

  const pages:
    CrawledPage[] =
    [];

  /**
   * URLs that have already received a crawl attempt.
   */
  const visited =
    new Set<string>();

  /**
   * URLs currently waiting in the crawl queue.
   */
  const queued =
    new Set<string>();

  const queue:
    QueueItem[] =
    [];

  /* -------------------------------------------------------
     QUEUE HELPERS
  ------------------------------------------------------- */

  /**
   * Determine how many additional pages may still
   * be returned by this crawl.
   */
  function remainingPageSlots(): number {
    return Math.max(
      0,
      pageLimit -
        pages.length
    );
  }

  /**
   * Add a URL to the crawl queue only when:
   *
   * - page capacity remains
   * - queue capacity remains
   * - URL is valid
   * - URL is safe
   * - URL belongs to the same domain
   * - URL is within crawl depth
   * - URL is not already visited
   * - URL is not already queued
   * - robots.txt allows it
   */
  function enqueue(
    url: string,
    depth: number
  ): boolean {
    /**
     * Once the hard page limit is reached,
     * nothing else may enter the queue.
     */
    if (
      pages.length >=
      pageLimit
    ) {
      return false;
    }

    /**
     * Keep the candidate queue bounded by
     * the number of pages still available.
     *
     * Example:
     *
     * pageLimit = 25
     * pages.length = 10
     *
     * maximum queue size = 15
     */
    const remaining =
      remainingPageSlots();

    if (
      queue.length >=
      remaining
    ) {
      return false;
    }

    try {
      const normalized =
        normalizeUrl(
          url
        );

      const parsed =
        assertSafeUrl(
          normalized
        );

      const hostname =
        normalizeHostname(
          parsed.hostname
        );

      /**
       * Only crawl the original domain.
       */
      if (
        hostname !==
        baseHostname
      ) {
        return false;
      }

      /**
       * Respect maximum crawl depth.
       */
      if (
        depth >
        depthLimit
      ) {
        return false;
      }

      /**
       * Prevent duplicate candidates.
       */
      if (
        visited.has(
          normalized
        ) ||
        queued.has(
          normalized
        )
      ) {
        return false;
      }

      /**
       * Respect robots.txt before queueing.
       */
      if (
        !isAllowedByRobots(
          normalized,
          robotsTxt
        )
      ) {
        return false;
      }

      queued.add(
        normalized
      );

      queue.push({
        url:
          normalized,

        depth,
      });

      return true;
    } catch {
      /**
       * Invalid or unsafe URLs are ignored.
       */
      return false;
    }
  }

  /* -------------------------------------------------------
     START URL
  ------------------------------------------------------- */

  /**
   * The starting URL ALWAYS gets first priority.
   *
   * This is important because sitemap discovery
   * should never cause the homepage/start page to
   * be pushed out of the crawl budget.
   */
  enqueue(
    normalizedStartUrl,
    0
  );

  /* -------------------------------------------------------
     SITEMAP CANDIDATES
  ------------------------------------------------------- */

  /**
   * Add sitemap URLs only while there is still
   * available queue capacity.
   *
   * Sitemap URLs are depth 0 because sitemap
   * membership does not represent link depth.
   */
  for (
    const sitemapUrl of
      sitemapResult.discoveredPageUrls
  ) {
    if (
      pages.length >=
      pageLimit
    ) {
      break;
    }

    if (
      queue.length >=
      remainingPageSlots()
    ) {
      break;
    }

    enqueue(
      sitemapUrl,
      0
    );
  }

  /* -------------------------------------------------------
     MAIN CRAWL LOOP
  ------------------------------------------------------- */

  while (
    queue.length > 0 &&
    pages.length <
      pageLimit
  ) {
    /**
     * Breadth-first crawling:
     *
     * shallow pages are processed before
     * deeper pages.
     */
    queue.sort(
      (
        a,
        b
      ) =>
        a.depth -
        b.depth
    );

    const item =
      queue.shift();

    if (
      !item
    ) {
      continue;
    }

    queued.delete(
      item.url
    );

    /**
     * A URL should only receive one crawl attempt.
     */
    if (
      visited.has(
        item.url
      )
    ) {
      continue;
    }

    /**
     * Final hard-limit check immediately before
     * network access.
     *
     * This is especially important if the crawler
     * is changed to use concurrent workers later.
     */
    if (
      pages.length >=
      pageLimit
    ) {
      break;
    }

    /**
     * Mark as attempted before fetching.
     *
     * Failed URLs therefore cannot be retried
     * through another discovery path.
     */
    visited.add(
      item.url
    );

    /**
     * Re-check robots.txt immediately before
     * the actual network request.
     */
    if (
      !isAllowedByRobots(
        item.url,
        robotsTxt
      )
    ) {
      continue;
    }

    let page:
      CrawledPage;

    try {
      page =
        await fetchPage(
          item.url
        );
    } catch (
      error
    ) {
      console.error(
        `Crawler failed for ${item.url}:`,
        error
      );

      /**
       * A failed request does not consume a
       * returned page slot.
       *
       * The crawler may therefore continue with
       * another queued candidate.
       */
      continue;
    }

    /**
     * Preserve the queue depth.
     */
    page.depth =
      item.depth;

    /**
     * Defensive hard-limit check immediately
     * before adding the result.
     *
     * Under the current sequential crawler this
     * should always be true, but it protects the
     * invariant if concurrency is introduced later.
     */
    if (
      pages.length >=
      pageLimit
    ) {
      break;
    }

    /**
     * This is the ONLY place where a successfully
     * fetched page is added to the crawl result.
     *
     * Therefore pages.length is the authoritative
     * per-audit page count.
     */
    pages.push(
      page
    );

    /**
     * HARD STOP.
     *
     * Once the plan's page limit has been reached,
     * do not:
     *
     * - extract more links
     * - enqueue more URLs
     * - perform another fetch
     */
    if (
      pages.length >=
      pageLimit
    ) {
      break;
    }

    /* -----------------------------------------------------
       INTERNAL LINK DISCOVERY
    ----------------------------------------------------- */

    /**
     * Only successful HTML responses can contribute
     * internal links to the crawl.
     */
    if (
      page.html &&
      page.statusCode >=
        200 &&
      page.statusCode <
        300 &&
      item.depth <
        depthLimit
    ) {
      const links =
        extractLinks(
          page.html,
          page.finalUrl
        );

      for (
        const link of
          links
      ) {
        /**
         * Stop immediately if the page budget
         * has been reached.
         */
        if (
          pages.length >=
          pageLimit
        ) {
          break;
        }

        /**
         * Keep the candidate queue bounded.
         */
        if (
          queue.length >=
          remainingPageSlots()
        ) {
          break;
        }

        /**
         * enqueue() performs all additional
         * validation:
         *
         * - URL normalization
         * - HTTP(S) validation
         * - unsafe hostname protection
         * - same-domain validation
         * - depth validation
         * - duplicate detection
         * - robots.txt validation
         * - queue/page budget validation
         */
        enqueue(
          link,
          item.depth + 1
        );
      }
    }
  }

  /* -------------------------------------------------------
     FINAL SAFETY INVARIANT
  ------------------------------------------------------- */

  /**
   * This should never happen because every insertion
   * into `pages` is protected by the page limit.
   *
   * Keep the final defensive slice anyway so that
   * future crawler changes cannot accidentally return
   * more pages than the subscription allows.
   */
  const limitedPages =
    pages.length >
    pageLimit
      ? pages.slice(
          0,
          pageLimit
        )
      : pages;

  return {
    pages:
      limitedPages,

    robotsTxt,

    sitemapUrls:
      sitemapResult.sitemapUrls,
  };
}

/* =========================================================
   BACKWARD-COMPATIBLE ALIAS
========================================================= */

export const crawl =
  crawlWebsite;