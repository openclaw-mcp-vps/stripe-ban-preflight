import { NextRequest, NextResponse } from "next/server";

import { enrichRiskAssessmentWithAI } from "@/lib/ai-analyzer";
import {
  ACCESS_COOKIE,
  ANALYSIS_CACHE_TTL_MS,
  SESSION_COOKIE,
} from "@/lib/constants";
import {
  getLatestAnalysis,
  getStripeConnection,
  saveAnalysis,
  type PersistedAnalysis,
} from "@/lib/db";
import { calculateSuspensionRisk } from "@/lib/risk-calculator";
import { collectStripeRiskMetrics } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function createAnalysis(sessionId: string): Promise<PersistedAnalysis> {
  const connection = await getStripeConnection(sessionId);

  if (!connection) {
    throw new Error("No Stripe account connected for this session");
  }

  const stripeRisk = await collectStripeRiskMetrics(connection.accessToken);
  const baseAssessment = calculateSuspensionRisk(stripeRisk.metrics);
  const aiAssessment = await enrichRiskAssessmentWithAI(
    stripeRisk.metrics,
    baseAssessment,
  );

  const analysis: PersistedAnalysis = {
    generatedAt: new Date().toISOString(),
    provider: aiAssessment.provider,
    riskScore: baseAssessment.riskScore,
    riskLevel: baseAssessment.riskLevel,
    summary: aiAssessment.summary,
    factors: baseAssessment.factors,
    recommendations:
      aiAssessment.recommendations.length >= 3
        ? aiAssessment.recommendations.slice(0, 3)
        : baseAssessment.recommendations,
    complianceFlags: [
      ...new Set([...baseAssessment.complianceFlags, ...aiAssessment.complianceFlags]),
    ].slice(0, 8),
    metrics: baseAssessment.metrics,
    account: stripeRisk.account,
  };

  await saveAnalysis(sessionId, analysis);

  return analysis;
}

async function handleAnalysis(request: NextRequest) {
  const accessCookie = request.cookies.get(ACCESS_COOKIE)?.value;

  if (accessCookie !== "granted") {
    return NextResponse.json(
      { error: "Payment required. Complete checkout to access this tool." },
      { status: 402 },
    );
  }

  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing session. Re-open the dashboard from the pricing page." },
      { status: 401 },
    );
  }

  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const cachedAnalysis = await getLatestAnalysis(sessionId);

  if (!forceRefresh && cachedAnalysis) {
    const age = Date.now() - new Date(cachedAnalysis.generatedAt).getTime();

    if (age <= ANALYSIS_CACHE_TTL_MS) {
      return NextResponse.json(cachedAnalysis, {
        headers: {
          "cache-control": "no-store",
        },
      });
    }
  }

  try {
    const analysis = await createAnalysis(sessionId);
    return NextResponse.json(analysis, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run Stripe risk analysis";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleAnalysis(request);
}

export async function POST(request: NextRequest) {
  return handleAnalysis(request);
}
