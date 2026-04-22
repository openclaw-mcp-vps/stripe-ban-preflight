import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { z } from "zod";

import type { StripeSignals, TrendPoint } from "@/lib/stripe-client";

export type RecommendationImpact = "High" | "Medium" | "Low";

export interface RiskRecommendation {
  title: string;
  impact: RecommendationImpact;
  whyItMatters: string;
  actionPlan: string;
}

export interface RiskMetrics {
  chargebackRate: number;
  refundRate: number;
  paymentFailureRate: number;
  disputes: number;
  accountRequirementCount: number;
  pastDueRequirements: number;
  sampleSize: number;
  dataFreshness: "live" | "webhook";
}

export type RiskLevel = "Low" | "Moderate" | "High" | "Critical";

export interface RiskAnalysis {
  score: number;
  level: RiskLevel;
  summary: string;
  modelSource: "heuristic" | "openai" | "claude";
  generatedAt: string;
  metrics: RiskMetrics;
  topFixes: RiskRecommendation[];
  trend: TrendPoint[];
}

const aiRecommendationSchema = z.object({
  title: z.string().min(8),
  impact: z.enum(["High", "Medium", "Low"]),
  whyItMatters: z.string().min(16),
  actionPlan: z.string().min(16),
});

const aiResponseSchema = z.object({
  summary: z.string().min(20),
  topFixes: z.array(aiRecommendationSchema).length(3),
});

function clampRisk(score: number): number {
  return Math.min(Math.max(Math.round(score), 1), 99);
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function getRiskLevel(score: number): RiskLevel {
  if (score < 30) {
    return "Low";
  }

  if (score < 55) {
    return "Moderate";
  }

  if (score < 75) {
    return "High";
  }

  return "Critical";
}

function scoreFromSignals(signals: StripeSignals): number {
  const riskScore =
    12 +
    signals.chargebackRate * 5200 +
    signals.refundRate * 1500 +
    signals.paymentFailureRate * 1400 +
    signals.disputes * 2.6 +
    signals.accountRequirementCount * 3 +
    signals.pastDueRequirements * 8;

  return clampRisk(riskScore);
}

function pushFix(
  fixes: RiskRecommendation[],
  title: string,
  impact: RecommendationImpact,
  whyItMatters: string,
  actionPlan: string,
): void {
  fixes.push({ title, impact, whyItMatters, actionPlan });
}

function buildHeuristicFixes(signals: StripeSignals): RiskRecommendation[] {
  const fixes: RiskRecommendation[] = [];

  if (signals.chargebackRate >= 0.006 || signals.disputes >= 3) {
    pushFix(
      fixes,
      "Deploy a pre-dispute rescue workflow",
      "High",
      `Your current chargeback exposure is ${percentage(signals.chargebackRate)}, which is within Stripe's review risk range for many SaaS verticals.`,
      "Send cancellation alternatives and usage receipts immediately after refund requests, then run cardholder outreach inside 12 hours for every new dispute.",
    );
  }

  if (signals.paymentFailureRate >= 0.08) {
    pushFix(
      fixes,
      "Reduce involuntary churn from failed payments",
      "High",
      `Payment failures are running at ${percentage(signals.paymentFailureRate)}, which inflates refund and dispute pressure in later billing cycles.`,
      "Enable smart retries, card updater, and a 3-email dunning ladder with one-click payment method update before account lockout.",
    );
  }

  if (signals.refundRate >= 0.06) {
    pushFix(
      fixes,
      "Tighten onboarding and value communication",
      "Medium",
      `Refund velocity at ${percentage(signals.refundRate)} signals expectation mismatch and can be interpreted as product dissatisfaction risk.`,
      "Add day-0 onboarding milestones, proactive 'first value' check-ins, and explicit billing descriptors in your welcome sequence.",
    );
  }

  if (signals.accountRequirementCount > 0 || signals.pastDueRequirements > 0) {
    pushFix(
      fixes,
      "Clear all pending Stripe compliance requirements",
      "High",
      `Stripe currently flags ${signals.accountRequirementCount} active requirements and ${signals.pastDueRequirements} past-due items.`,
      "Submit outstanding KYC/business profile documents, confirm descriptor/support URL consistency, and review any restricted-business mismatch.",
    );
  }

  const fraudDisputes = signals.disputeReasons.fraudulent ?? 0;
  if (fraudDisputes > 0) {
    pushFix(
      fixes,
      "Harden anti-fraud and transaction authentication",
      "Medium",
      `${fraudDisputes} recent disputes were tagged as fraudulent, making future payment volume riskier without stronger controls.`,
      "Turn on stricter radar rules, force 3DS for high-risk geos, and block repeat BIN/device fingerprints with elevated dispute history.",
    );
  }

  if (fixes.length < 3) {
    pushFix(
      fixes,
      "Add proactive cancellation prevention before renewal",
      "Medium",
      "Most suspensions are preceded by late-stage frustration signals that can be intercepted before they convert into disputes.",
      "Trigger outreach 5 days pre-renewal for low-usage accounts and offer downgrade/pause options before charging a dissatisfied customer.",
    );
  }

  if (fixes.length < 3) {
    pushFix(
      fixes,
      "Publish a clearer refund and support path",
      "Low",
      "Unclear support channels increase cardholder bank escalation and weaken your evidence quality in formal disputes.",
      "Place refund policy, SLA response windows, and a visible support email on checkout, invoice, and in-app billing screens.",
    );
  }

  return fixes.slice(0, 3);
}

function buildSummary(level: RiskLevel, signals: StripeSignals): string {
  if (level === "Critical") {
    return `Critical suspension risk detected. Chargebacks (${percentage(signals.chargebackRate)}) and compliance pressure indicate immediate intervention is required this week.`;
  }

  if (level === "High") {
    return `High suspension risk. Dispute and refund patterns are elevated enough to warrant an immediate prevention sprint before payment volume scales further.`;
  }

  if (level === "Moderate") {
    return `Moderate risk posture. You are not in immediate danger, but current patterns leave limited room for error if volume or dispute rates increase.`;
  }

  return `Low risk posture. Stripe health looks stable, with room to tighten controls before growth introduces new dispute and compliance stress.`;
}

function extractJsonObject(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("No JSON object found in AI response");
    }

    return JSON.parse(match[0]);
  }
}

async function askOpenAI(
  score: number,
  level: RiskLevel,
  signals: StripeSignals,
): Promise<z.infer<typeof aiResponseSchema> | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const client = new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a Stripe risk analyst. Return strict JSON with fields: summary and topFixes. topFixes must contain exactly 3 concrete, non-overlapping recommendations.",
      },
      {
        role: "user",
        content: JSON.stringify({
          score,
          level,
          chargebackRate: signals.chargebackRate,
          refundRate: signals.refundRate,
          paymentFailureRate: signals.paymentFailureRate,
          disputes: signals.disputes,
          accountRequirementCount: signals.accountRequirementCount,
          pastDueRequirements: signals.pastDueRequirements,
          disputeReasons: signals.disputeReasons,
        }),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return null;
  }

  const parsed = aiResponseSchema.safeParse(extractJsonObject(content));
  return parsed.success ? parsed.data : null;
}

async function askClaude(
  score: number,
  level: RiskLevel,
  signals: StripeSignals,
): Promise<z.infer<typeof aiResponseSchema> | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL ?? "claude-3-5-sonnet-latest",
      max_tokens: 800,
      temperature: 0.2,
      system:
        "You are a Stripe risk analyst. Return only valid JSON with keys summary and topFixes. topFixes must contain exactly 3 items.",
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            score,
            level,
            chargebackRate: signals.chargebackRate,
            refundRate: signals.refundRate,
            paymentFailureRate: signals.paymentFailureRate,
            disputes: signals.disputes,
            accountRequirementCount: signals.accountRequirementCount,
            pastDueRequirements: signals.pastDueRequirements,
            disputeReasons: signals.disputeReasons,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const json = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };

  const content =
    json.content
      ?.filter((item) => item.type === "text" && item.text)
      .map((item) => item.text)
      .join("\n") ?? "";

  if (!content) {
    return null;
  }

  const parsed = aiResponseSchema.safeParse(extractJsonObject(content));
  return parsed.success ? parsed.data : null;
}

async function persistSnapshot(analysis: RiskAnalysis, signals: StripeSignals): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey || !signals.connectedAccountId) {
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    await supabase.from("risk_snapshots").insert({
      connected_account_id: signals.connectedAccountId,
      score: analysis.score,
      level: analysis.level,
      model_source: analysis.modelSource,
      generated_at: analysis.generatedAt,
      metrics: analysis.metrics,
      top_fixes: analysis.topFixes,
    });
  } catch {
    // Optional persistence only. Fail-open for API response reliability.
  }
}

export async function analyzeSuspensionRisk(signals: StripeSignals): Promise<RiskAnalysis> {
  const score = scoreFromSignals(signals);
  const level = getRiskLevel(score);
  const heuristicFixes = buildHeuristicFixes(signals);

  let summary = buildSummary(level, signals);
  let topFixes = heuristicFixes;
  let modelSource: RiskAnalysis["modelSource"] = "heuristic";

  try {
    const openAiResult = await askOpenAI(score, level, signals);

    if (openAiResult) {
      summary = openAiResult.summary;
      topFixes = openAiResult.topFixes;
      modelSource = "openai";
    } else {
      const claudeResult = await askClaude(score, level, signals);
      if (claudeResult) {
        summary = claudeResult.summary;
        topFixes = claudeResult.topFixes;
        modelSource = "claude";
      }
    }
  } catch {
    // If model calls fail, heuristic output is returned.
  }

  const analysis: RiskAnalysis = {
    score,
    level,
    summary,
    modelSource,
    generatedAt: new Date().toISOString(),
    metrics: {
      chargebackRate: signals.chargebackRate,
      refundRate: signals.refundRate,
      paymentFailureRate: signals.paymentFailureRate,
      disputes: signals.disputes,
      accountRequirementCount: signals.accountRequirementCount,
      pastDueRequirements: signals.pastDueRequirements,
      sampleSize: signals.sampleSize,
      dataFreshness: signals.dataFreshness,
    },
    topFixes,
    trend: signals.trend,
  };

  await persistSnapshot(analysis, signals);
  return analysis;
}
