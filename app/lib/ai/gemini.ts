import { GoogleGenAI, Type } from "@google/genai";

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
    throw new Error(
      "Gemini API is not configured. Add GEMINI_API_KEY to your environment variables."
    );
  }

  const model =
    process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";

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

  try {
    const response = await ai.models.generateContent({
      model,

      contents: prompt,

      config: {
        temperature: 0.2,

        responseMimeType: "application/json",

        responseSchema,
      },
    });

    const text = response.text?.trim();

    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Gemini returned invalid JSON.");
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Gemini returned an invalid recommendation object.");
    }

    const result = parsed as AISEORecommendations;

    if (
      typeof result.summary !== "string" ||
      !Array.isArray(result.recommendations) ||
      !Array.isArray(result.quickWins) ||
      !Array.isArray(result.technicalNotes)
    ) {
      throw new Error(
        "Gemini returned an unexpected recommendation structure."
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
  } catch (error) {
    console.error("Gemini SEO recommendation error:", error);

    if (error instanceof Error) {
      throw new Error(
        `Unable to generate AI SEO recommendations: ${error.message}`
      );
    }

    throw new Error(
      "Unable to generate AI SEO recommendations."
    );
  }
}