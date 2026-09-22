import { GoogleGenAI, Type } from "@google/genai";

/* =========================================================
   CLIENT
========================================================= */

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn(
    "GEMINI_API_KEY is not configured. AI SEO recommendations will be unavailable."
  );
}

const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
    })
  : null;

/* =========================================================
   TYPES
========================================================= */

export type AIRecommendation = {
  title: string;
  priority: "high" | "medium" | "low";
  category: string;
  problem: string;
  whyItMatters: string;
  recommendation: string;
  actionSteps: string[];
  affectedPages: string[];
};

export type AISEORecommendations = {
  summary: string;
  recommendations: AIRecommendation[];
  quickWins: string[];
  technicalNotes: string[];
};

export type AIRecommendationErrorCode =
  | "NOT_CONFIGURED"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "INVALID_RESPONSE"
  | "UNKNOWN";

export class AIRecommendationError extends Error {
  code: AIRecommendationErrorCode;

  constructor(code: AIRecommendationErrorCode, message: string) {
    super(message);
    this.name = "AIRecommendationError";
    this.code = code;
  }
}

/* =========================================================
   MODEL FALLBACK CHAIN
========================================================= */

/**
 * Preferred model comes from GEMINI_MODEL, with a stable default.
 * The remaining entries are fallbacks used only when the primary
 * model returns 404 (deprecated), 429 (rate limited), or 503
 * (overloaded).
 *
 * Google rotates model names frequently — keep the tail of this
 * list to 1–2 currently-supported Flash models.
 */
function getModelChain(): string[] {
  const primary =
    process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";

  const fallbacks = [
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
  ];

  // De-duplicate in case GEMINI_MODEL matches a fallback.
  return Array.from(new Set([primary, ...fallbacks]));
}

/* =========================================================
   RESPONSE SCHEMA
========================================================= */

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description:
        "A concise professional summary of the website's most important SEO problems and opportunities.",
    },

    recommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
          },

          priority: {
            type: Type.STRING,
            enum: ["high", "medium", "low"],
          },

          category: {
            type: Type.STRING,
          },

          problem: {
            type: Type.STRING,
          },

          whyItMatters: {
            type: Type.STRING,
          },

          recommendation: {
            type: Type.STRING,
          },

          actionSteps: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
          },

          affectedPages: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
          },
        },

        required: [
          "title",
          "priority",
          "category",
          "problem",
          "whyItMatters",
          "recommendation",
          "actionSteps",
          "affectedPages",
        ],
      },
    },

    quickWins: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
    },

    technicalNotes: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
    },
  },

  required: [
    "summary",
    "recommendations",
    "quickWins",
    "technicalNotes",
  ],
};

/* =========================================================
   ERROR PARSING
========================================================= */

type GeminiErrorBody = {
  code?: number;
  status?: string;
  details?: unknown[];
};

/**
 * @google/genai wraps Google's structured error as an ApiError whose
 * `message` string contains the raw JSON body:
 *
 *   Error [ApiError]: {"error":{"code":503,"status":"UNAVAILABLE",...}}
 *
 * Top-level fields on the error object are unreliable — sometimes
 * only the HTTP status number is exposed. This helper extracts the
 * underlying Google error object from whichever shape is present.
 */
function getGeminiErrorBody(error: unknown): GeminiErrorBody {
  if (!error || typeof error !== "object") return {};

  const e = error as {
    code?: number;
    status?: number | string;
    message?: string;
    details?: unknown;
  };

  // 1. Structured top-level details (newer SDK versions).
  if (Array.isArray(e.details)) {
    return {
      code: typeof e.code === "number" ? e.code : undefined,
      status:
        typeof e.status === "string" ? e.status : undefined,
      details: e.details,
    };
  }

  // 2. Parse the JSON body out of message.
  if (typeof e.message === "string") {
    const jsonStart = e.message.indexOf("{");

    if (jsonStart !== -1) {
      try {
        const parsed = JSON.parse(e.message.slice(jsonStart));
        const inner =
          parsed && typeof parsed === "object" && "error" in parsed
            ? (parsed as { error: unknown }).error
            : parsed;

        if (inner && typeof inner === "object") {
          const obj = inner as {
            code?: unknown;
            status?: unknown;
            details?: unknown;
          };

          return {
            code:
              typeof obj.code === "number" ? obj.code : undefined,
            status:
              typeof obj.status === "string" ? obj.status : undefined,
            details: Array.isArray(obj.details)
              ? obj.details
              : undefined,
          };
        }
      } catch {
        // fall through to regex
      }
    }

    // 3. Regex fallback for the common shapes.
    const statusMatch = e.message.match(/"status"\s*:\s*"([A-Z_]+)"/);
    const codeMatch = e.message.match(/"code"\s*:\s*(\d+)/);

    if (statusMatch || codeMatch) {
      return {
        status: statusMatch?.[1],
        code: codeMatch ? Number(codeMatch[1]) : undefined,
      };
    }
  }

  // 4. Last resort: the HTTP status number.
  if (typeof e.status === "number") {
    return { code: e.status };
  }

  return {};
}

function isRateLimitError(error: unknown): boolean {
  const { code, status } = getGeminiErrorBody(error);

  return code === 429 || status === "RESOURCE_EXHAUSTED";
}

function isTransientError(error: unknown): boolean {
  const { code, status } = getGeminiErrorBody(error);

  return (
    code === 500 ||
    code === 502 ||
    code === 503 ||
    code === 504 ||
    status === "INTERNAL" ||
    status === "UNAVAILABLE" ||
    status === "DEADLINE_EXCEEDED"
  );
}

function isModelNotFoundError(error: unknown): boolean {
  const { code, status } = getGeminiErrorBody(error);

  return code === 404 || status === "NOT_FOUND";
}

/**
 * Pull the RetryInfo.retryDelay value (e.g. "34.234011591s") from
 * the structured error body, if present.
 */
function extractRetryDelayMs(error: unknown): number | null {
  const { details } = getGeminiErrorBody(error);

  if (!Array.isArray(details)) return null;

  for (const detail of details) {
    if (!detail || typeof detail !== "object") continue;

    const entry = detail as {
      "@type"?: string;
      retryDelay?: string;
    };

    if (
      entry["@type"] ===
        "type.googleapis.com/google.rpc.RetryInfo" &&
      typeof entry.retryDelay === "string"
    ) {
      const match = entry.retryDelay.match(/^([\d.]+)s$/);

      if (match) {
        return Math.ceil(parseFloat(match[1]) * 1000);
      }
    }
  }

  return null;
}

/* =========================================================
   RETRY
========================================================= */

/**
 * Call Gemini with retry-on-transient-failure semantics.
 *
 * - Permanent errors (bad request, auth, invalid arg) are re-thrown
 *   immediately so callers get fast feedback.
 * - 429 and 5xx are retried with exponential backoff, capped, and
 *   honour Google's own retryDelay when present.
 */
async function callGeminiWithRetry(
  client: GoogleGenAI,
  params: Parameters<typeof client.models.generateContent>[0],
  maxAttempts = 4
): Promise<Awaited<ReturnType<typeof client.models.generateContent>>> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await client.models.generateContent(params);
    } catch (error) {
      lastError = error;

      const retriable =
        isRateLimitError(error) || isTransientError(error);

      if (!retriable || attempt === maxAttempts) {
        throw error;
      }

      const suggested = extractRetryDelayMs(error);

      const backoffMs = Math.min(
        2000 * Math.pow(2, attempt - 1),
        30000
      );

      const delayMs = suggested ?? backoffMs;

      console.warn(
        `[ai] Gemini call failed (attempt ${attempt}/${maxAttempts}), ` +
          `retrying in ${delayMs}ms`,
        isRateLimitError(error) ? "(rate limit)" : "(transient)"
      );

      await new Promise((resolve) =>
        setTimeout(resolve, delayMs)
      );
    }
  }

  throw lastError;
}

/* =========================================================
   MAIN
========================================================= */

export async function generateSEORecommendations(input: {
  domain: string;
  auditUrl: string;
  score: number | null;
  sitewideScore: number | null;

  pagesCrawled: number;
  pagesWithErrors: number;
  pagesWithWarnings: number;
  pagesPassed: number;

  duplicateTitleCount: number;
  duplicateMetaCount: number;
  thinContentCount: number;
  orphanPageCount: number;
  brokenLinkCount: number;
  canonicalConflictCount: number;
  redirectChainCount: number;

  categoryScores: Record<string, number>;

  issues: {
    category: string;
    type: string;
    severity: string;
    title: string;
    description: string | null;
    recommendation: string | null;
    pageUrl: string | null;
  }[];

  pages: {
    url: string;
    finalUrl: string | null;
    statusCode: number | null;
    title: string | null;
    metaDescription: string | null;
    canonicalUrl: string | null;
    wordCount: number | null;
    h1Count: number | null;
    imagesWithoutAlt: number | null;
    internalLinksCount: number | null;
    responseTimeMs: number | null;
    pageScore: number | null;
    isIndexable: boolean | null;
  }[];
}): Promise<AISEORecommendations> {
  if (!ai) {
    throw new AIRecommendationError(
      "NOT_CONFIGURED",
      "AI recommendations are not available right now."
    );
  }

  /*
   * Keep the AI context compact.
   *
   * Gemini does not need the entire HTML document. The deterministic
   * SEO analyzer has already extracted the information we need.
   */

  const limitedIssues = input.issues.slice(0, 40);

  const limitedPages = input.pages.slice(0, 50).map((page) => ({
    url: page.url,
    finalUrl: page.finalUrl,
    statusCode: page.statusCode,
    title: page.title,
    metaDescription: page.metaDescription,
    canonicalUrl: page.canonicalUrl,
    wordCount: page.wordCount,
    h1Count: page.h1Count,
    imagesWithoutAlt: page.imagesWithoutAlt,
    internalLinksCount: page.internalLinksCount,
    responseTimeMs: page.responseTimeMs,
    pageScore: page.pageScore,
    isIndexable: page.isIndexable,
  }));

  const payload = {
    website: input.domain,
    auditUrl: input.auditUrl,

    scores: {
      pageAuditScore: input.score,
      sitewideScore: input.sitewideScore,
      categoryScores: input.categoryScores,
    },

    crawlSummary: {
      pagesCrawled: input.pagesCrawled,
      pagesWithErrors: input.pagesWithErrors,
      pagesWithWarnings: input.pagesWithWarnings,
      pagesPassed: input.pagesPassed,
    },

    sitewideProblems: {
      duplicateTitleCount: input.duplicateTitleCount,
      duplicateMetaCount: input.duplicateMetaCount,
      thinContentCount: input.thinContentCount,
      orphanPageCount: input.orphanPageCount,
      brokenLinkCount: input.brokenLinkCount,
      canonicalConflictCount: input.canonicalConflictCount,
      redirectChainCount: input.redirectChainCount,
    },

    detectedIssues: limitedIssues,
    pages: limitedPages,
  };

  const prompt = `
You are the SEO recommendation engine for a professional website auditing SaaS.

Your task is to analyze the structured SEO audit data below and provide practical, accurate and prioritized recommendations.

IMPORTANT RULES:

1. Do NOT invent SEO problems that are not supported by the supplied audit data.
2. Do NOT change or calculate the SEO score.
3. The deterministic audit engine is the source of truth.
4. Explain existing problems and recommend how the website owner can fix them.
5. Prioritize issues based on SEO impact and the supplied severity.
6. Focus on actionable recommendations rather than generic SEO advice.
7. Avoid keyword-stuffing advice.
8. Do not claim that fixing an issue guarantees higher Google rankings.
9. If there is insufficient evidence for a recommendation, do not make it.
10. Keep recommendations understandable to a normal website owner.
11. For affectedPages, only use URLs supplied in the input.
12. Return no more than 8 major recommendations.
13. Return no more than 5 quick wins.
14. Keep the summary concise.
15. Do not recommend buying backlinks, manipulating search engines, or other spam techniques.

The website audit data is:

${JSON.stringify(payload, null, 2)}

Generate a professional SEO action plan based strictly on this data.
`;

  /*
   * Try the preferred model, then fall back on 404 / 429 / 5xx.
   * Permanent errors are re-thrown immediately so we don't waste
   * time cycling through models for a bad-request failure.
   */
  const models = getModelChain();

  let response:
    | Awaited<ReturnType<typeof ai.models.generateContent>>
    | null = null;

  let lastError: unknown = null;

  for (const model of models) {
    try {
      response = await callGeminiWithRetry(ai, {
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema,
        },
      });

      if (models[0] !== model) {
        console.warn(
          `[ai] Fell back to model "${model}" after primary failure.`
        );
      }

      break;
    } catch (error) {
      lastError = error;

      const switchable =
        isModelNotFoundError(error) ||
        isRateLimitError(error) ||
        isTransientError(error);

      if (!switchable) {
        // Permanent error — stop trying other models.
        break;
      }

      console.warn(
        `[ai] Model "${model}" failed; trying next fallback.`
      );
    }
  }

  if (!response) {
    console.error("[ai] Gemini request failed:", lastError);

    if (isRateLimitError(lastError)) {
      throw new AIRecommendationError(
        "RATE_LIMITED",
        "The AI service is busy right now. Please try again in a minute."
      );
    }

    if (isTransientError(lastError)) {
      throw new AIRecommendationError(
        "SERVICE_UNAVAILABLE",
        "The AI service is temporarily unavailable. Please try again shortly."
      );
    }

    if (isModelNotFoundError(lastError)) {
      throw new AIRecommendationError(
        "SERVICE_UNAVAILABLE",
        "The AI service is temporarily unavailable. Please try again shortly."
      );
    }

    throw new AIRecommendationError(
      "UNKNOWN",
      "Unable to generate AI SEO recommendations."
    );
  }

  const text = response.text?.trim();

  if (!text) {
    throw new AIRecommendationError(
      "INVALID_RESPONSE",
      "The AI service returned an empty response. Please try again."
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AIRecommendationError(
      "INVALID_RESPONSE",
      "The AI service returned an unreadable response. Please try again."
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new AIRecommendationError(
      "INVALID_RESPONSE",
      "The AI service returned an invalid recommendation payload. Please try again."
    );
  }

  const result = parsed as AISEORecommendations;

  if (
    typeof result.summary !== "string" ||
    !Array.isArray(result.recommendations) ||
    !Array.isArray(result.quickWins) ||
    !Array.isArray(result.technicalNotes)
  ) {
    throw new AIRecommendationError(
      "INVALID_RESPONSE",
      "The AI service returned an unexpected recommendation structure. Please try again."
    );
  }

  return {
    summary: result.summary.trim(),

    recommendations: result.recommendations
      .slice(0, 8)
      .map((recommendation) => ({
        title: String(recommendation.title || "").trim(),

        priority:
          recommendation.priority === "high" ||
          recommendation.priority === "medium" ||
          recommendation.priority === "low"
            ? recommendation.priority
            : "medium",

        category: String(recommendation.category || "SEO").trim(),

        problem: String(recommendation.problem || "").trim(),

        whyItMatters: String(
          recommendation.whyItMatters || ""
        ).trim(),

        recommendation: String(
          recommendation.recommendation || ""
        ).trim(),

        actionSteps: Array.isArray(recommendation.actionSteps)
          ? recommendation.actionSteps
              .map((step) => String(step).trim())
              .filter(Boolean)
              .slice(0, 6)
          : [],

        affectedPages: Array.isArray(
          recommendation.affectedPages
        )
          ? recommendation.affectedPages
              .map((page) => String(page).trim())
              .filter(Boolean)
              .slice(0, 20)
          : [],
      }))
      .filter(
        (recommendation) =>
          recommendation.title &&
          recommendation.problem &&
          recommendation.recommendation
      ),

    quickWins: result.quickWins
      .map((item) => String(item).trim())
      .filter(Boolean)
      .slice(0, 5),

    technicalNotes: result.technicalNotes
      .map((item) => String(item).trim())
      .filter(Boolean)
      .slice(0, 8),
  };
}