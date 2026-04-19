import OpenAI from "openai";
import { z } from "zod";

import type {
  RiskMetrics,
  RiskRecommendation,
  RuleBasedAssessment,
} from "@/lib/risk-calculator";

const aiResponseSchema = z.object({
  summary: z.string().min(20),
  complianceFlags: z.array(z.string()).max(8).default([]),
  recommendations: z
    .array(
      z.object({
        title: z.string(),
        whyItMatters: z.string(),
        action: z.string(),
        expectedImpact: z.string(),
      }),
    )
    .min(3)
    .max(5),
});

type AIProvider = "rules" | "openai" | "anthropic";

export interface AIAnalysisResult {
  provider: AIProvider;
  summary: string;
  complianceFlags: string[];
  recommendations: RiskRecommendation[];
}

function toRecommendations(
  items: z.infer<typeof aiResponseSchema>["recommendations"],
): RiskRecommendation[] {
  return items.slice(0, 3).map((item, index) => ({
    ...item,
    priority: 100 - index * 5,
  }));
}

function extractJsonObject(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI response did not include a JSON object");
  }

  return raw.slice(start, end + 1);
}

async function analyzeWithOpenAI(
  metrics: RiskMetrics,
  base: RuleBasedAssessment,
): Promise<AIAnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const client = new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a Stripe risk analyst. Return JSON only with keys: summary, complianceFlags, recommendations. recommendations must include exactly 3 practical, non-generic fixes.",
      },
      {
        role: "user",
        content: JSON.stringify({
          objective:
            "Predict Stripe suspension risk and provide top fixes that can be implemented in 7 days.",
          metrics,
          baseAssessment: base,
        }),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;

  if (!raw) {
    throw new Error("OpenAI returned an empty message");
  }

  const parsed = aiResponseSchema.parse(JSON.parse(extractJsonObject(raw)));

  return {
    provider: "openai",
    summary: parsed.summary,
    complianceFlags: parsed.complianceFlags,
    recommendations: toRecommendations(parsed.recommendations),
  };
}

async function analyzeWithAnthropic(
  metrics: RiskMetrics,
  base: RuleBasedAssessment,
): Promise<AIAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest",
      max_tokens: 1000,
      temperature: 0.2,
      system:
        "You are a Stripe policy risk analyst. Return only valid JSON with keys: summary, complianceFlags, recommendations. recommendations must include exactly 3 practical actions.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: JSON.stringify({
                objective:
                  "Predict Stripe suspension risk and produce practical remediations for a SaaS merchant.",
                metrics,
                baseAssessment: base,
              }),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic request failed: ${response.status} ${errorBody}`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const rawText = payload.content
    ?.find((item) => item.type === "text" && typeof item.text === "string")
    ?.text?.trim();

  if (!rawText) {
    throw new Error("Anthropic returned no text content");
  }

  const parsed = aiResponseSchema.parse(JSON.parse(extractJsonObject(rawText)));

  return {
    provider: "anthropic",
    summary: parsed.summary,
    complianceFlags: parsed.complianceFlags,
    recommendations: toRecommendations(parsed.recommendations),
  };
}

export async function enrichRiskAssessmentWithAI(
  metrics: RiskMetrics,
  base: RuleBasedAssessment,
): Promise<AIAnalysisResult> {
  try {
    if (process.env.OPENAI_API_KEY) {
      return await analyzeWithOpenAI(metrics, base);
    }

    if (process.env.ANTHROPIC_API_KEY) {
      return await analyzeWithAnthropic(metrics, base);
    }
  } catch {
    // Fall through to deterministic output
  }

  return {
    provider: "rules",
    summary: base.summary,
    complianceFlags: base.complianceFlags,
    recommendations: base.recommendations,
  };
}
