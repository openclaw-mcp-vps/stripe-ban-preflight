import { z } from "zod";

export const riskMetricsSchema = z.object({
  chargeCount90d: z.number().nonnegative(),
  disputeCount90d: z.number().nonnegative(),
  refundCount90d: z.number().nonnegative(),
  failedChargeCount90d: z.number().nonnegative(),
  lowValueAttemptCount90d: z.number().nonnegative(),
  avgTicketSize: z.number().nonnegative(),
  volumeDeltaPct: z.number(),
  openDisputeAmount: z.number().nonnegative(),
  mccRiskLabel: z.enum(["low", "medium", "high"]),
  policyKeywordHits: z.array(z.string()),
  externalSignals: z.array(z.string()),
});

export type RiskMetrics = z.infer<typeof riskMetricsSchema>;

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export interface RiskRecommendation {
  title: string;
  whyItMatters: string;
  action: string;
  expectedImpact: string;
  priority: number;
}

export interface RiskFactor {
  name: string;
  contribution: number;
  detail: string;
}

export interface RiskMetricSnapshot {
  chargeCount90d: number;
  disputeCount90d: number;
  chargebackRatePct: number;
  refundRatePct: number;
  failedChargeRatePct: number;
  avgTicketSize: number;
  volumeDeltaPct: number;
  openDisputeAmount: number;
}

export interface RuleBasedAssessment {
  riskScore: number;
  riskLevel: RiskLevel;
  summary: string;
  factors: RiskFactor[];
  recommendations: RiskRecommendation[];
  complianceFlags: string[];
  metrics: RiskMetricSnapshot;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function describeRiskLevel(level: RiskLevel): string {
  if (level === "low") {
    return "Low suspension risk. Maintain controls and monitor dispute trend weekly.";
  }

  if (level === "moderate") {
    return "Moderate risk. Stripe could flag the account if current trends continue.";
  }

  if (level === "high") {
    return "High risk. Immediate remediation is recommended to avoid account restrictions.";
  }

  return "Critical risk. Suspension probability is elevated without urgent policy and dispute fixes.";
}

export function calculateSuspensionRisk(input: RiskMetrics): RuleBasedAssessment {
  const metrics = riskMetricsSchema.parse(input);
  const safeChargeCount = Math.max(metrics.chargeCount90d, 1);

  const chargebackRate = metrics.disputeCount90d / safeChargeCount;
  const refundRate = metrics.refundCount90d / safeChargeCount;
  const failedRate = metrics.failedChargeCount90d / safeChargeCount;
  const lowValueAttemptRate = metrics.lowValueAttemptCount90d / safeChargeCount;

  const factors: RiskFactor[] = [];
  let score = 6;

  const chargebackContribution = clamp(chargebackRate * 2200, 0, 38);
  score += chargebackContribution;
  factors.push({
    name: "Chargeback Pressure",
    contribution: Math.round(chargebackContribution),
    detail: `${(chargebackRate * 100).toFixed(2)}% dispute rate over the last 90 days`,
  });

  const refundContribution = clamp(refundRate * 650, 0, 16);
  score += refundContribution;
  factors.push({
    name: "Refund Friction",
    contribution: Math.round(refundContribution),
    detail: `${(refundRate * 100).toFixed(2)}% refund rate indicates fulfillment or expectation issues`,
  });

  const failureContribution = clamp(failedRate * 450, 0, 14);
  score += failureContribution;
  factors.push({
    name: "Payment Reliability",
    contribution: Math.round(failureContribution),
    detail: `${(failedRate * 100).toFixed(2)}% failed charges can look like poor payment hygiene`,
  });

  const lowValueContribution = clamp(lowValueAttemptRate * 300, 0, 8);
  score += lowValueContribution;
  if (lowValueContribution > 0) {
    factors.push({
      name: "Card Testing Signal",
      contribution: Math.round(lowValueContribution),
      detail: `${(lowValueAttemptRate * 100).toFixed(2)}% low-ticket failed attempts suggest fraud probing`,
    });
  }

  if (metrics.volumeDeltaPct < -35) {
    const declineContribution = clamp(Math.abs(metrics.volumeDeltaPct) / 8, 0, 10);
    score += declineContribution;
    factors.push({
      name: "Volume Instability",
      contribution: Math.round(declineContribution),
      detail: `${Math.abs(metrics.volumeDeltaPct).toFixed(1)}% volume decline vs previous period`,
    });
  }

  if (metrics.mccRiskLabel === "high") {
    score += 10;
    factors.push({
      name: "Vertical Risk",
      contribution: 10,
      detail: "Business category belongs to Stripe's higher scrutiny MCC bands",
    });
  } else if (metrics.mccRiskLabel === "medium") {
    score += 5;
    factors.push({
      name: "Vertical Risk",
      contribution: 5,
      detail: "Business category has moderate policy sensitivity",
    });
  }

  if (metrics.openDisputeAmount > 0) {
    const disputeAmountContribution = clamp(metrics.openDisputeAmount / 2000, 0, 10);
    score += disputeAmountContribution;
    factors.push({
      name: "Open Dispute Exposure",
      contribution: Math.round(disputeAmountContribution),
      detail: `$${metrics.openDisputeAmount.toFixed(2)} remains unresolved in active disputes`,
    });
  }

  if (metrics.policyKeywordHits.length > 0) {
    const policyContribution = clamp(metrics.policyKeywordHits.length * 3, 0, 12);
    score += policyContribution;
    factors.push({
      name: "Policy Trigger Keywords",
      contribution: policyContribution,
      detail: `Detected signals: ${metrics.policyKeywordHits.join(", ")}`,
    });
  }

  if (metrics.externalSignals.length > 0) {
    const externalContribution = clamp(metrics.externalSignals.length * 2, 0, 8);
    score += externalContribution;
    factors.push({
      name: "Account Health Warnings",
      contribution: externalContribution,
      detail: metrics.externalSignals.join(" | "),
    });
  }

  const riskScore = Math.round(clamp(score, 0, 100));
  let riskLevel: RiskLevel = "low";

  if (riskScore >= 80) {
    riskLevel = "critical";
  } else if (riskScore >= 60) {
    riskLevel = "high";
  } else if (riskScore >= 35) {
    riskLevel = "moderate";
  }

  const suggestions: RiskRecommendation[] = [];

  if (chargebackRate >= 0.0075) {
    suggestions.push({
      title: "Cut dispute rate below 0.75% in 30 days",
      whyItMatters:
        "Stripe usually escalates monitoring once dispute ratio approaches 1%.",
      action:
        "Add post-purchase order confirmation emails, tighten refund SLAs to <24h, and route high-ticket orders through manual review.",
      expectedImpact: "Drops chargeback pressure by 20-40% when enforced consistently.",
      priority: 100,
    });
  }

  if (metrics.policyKeywordHits.length > 0) {
    suggestions.push({
      title: "Clean risky policy language from checkout and descriptors",
      whyItMatters:
        "Risky keywords can trigger automated compliance reviews even before disputes increase.",
      action:
        "Rewrite descriptor, checkout copy, and product metadata to avoid restricted terminology and add clear fulfillment terms.",
      expectedImpact: "Reduces automated policy flags and reserve probability.",
      priority: 92,
    });
  }

  if (failedRate >= 0.08 || lowValueAttemptRate >= 0.05) {
    suggestions.push({
      title: "Harden fraud controls against card testing",
      whyItMatters:
        "Burst low-value failures often precede issuer complaints and account restrictions.",
      action:
        "Enable velocity limits, require CAPTCHA on retry paths, and block repeated failures by BIN + IP fingerprint.",
      expectedImpact: "Cuts fraudulent attempts and lowers decline-driven risk signals.",
      priority: 88,
    });
  }

  if (refundRate >= 0.12) {
    suggestions.push({
      title: "Lower avoidable refunds with expectation controls",
      whyItMatters:
        "A high refund ratio signals customer dissatisfaction or mis-selling.",
      action:
        "Add delivery timeline commitments, pre-billing reminders, and quick cancel options before renewal capture.",
      expectedImpact: "Reduces refund volume and secondary disputes.",
      priority: 84,
    });
  }

  if (metrics.externalSignals.length > 0) {
    suggestions.push({
      title: "Clear Stripe account requirements this week",
      whyItMatters:
        "Unresolved account requirements increase payout interruption risk.",
      action:
        "Resolve currently_due fields, refresh KYC docs, and confirm business profile URL + support contacts.",
      expectedImpact: "Removes hard compliance blockers and stabilizes payout continuity.",
      priority: 79,
    });
  }

  suggestions.push(
    {
      title: "Publish a visible refund and contact policy",
      whyItMatters:
        "Clear support pathways reduce chargebacks from avoidable confusion.",
      action:
        "Expose policy links at checkout, in receipts, and in customer portal pages.",
      expectedImpact: "Improves customer trust and dispute deflection.",
      priority: 65,
    },
    {
      title: "Monitor risk score weekly with threshold alerts",
      whyItMatters:
        "Trend detection is more reliable than one-off snapshots.",
      action:
        "Track dispute ratio, failed charge rate, and reserve events with an escalation owner.",
      expectedImpact: "Prevents silent drift into high-risk territory.",
      priority: 60,
    },
  );

  const recommendations = suggestions
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);

  const complianceFlags = [
    ...metrics.policyKeywordHits,
    ...metrics.externalSignals,
  ].slice(0, 8);

  return {
    riskScore,
    riskLevel,
    summary: describeRiskLevel(riskLevel),
    factors: factors.sort((a, b) => b.contribution - a.contribution),
    recommendations,
    complianceFlags,
    metrics: {
      chargeCount90d: metrics.chargeCount90d,
      disputeCount90d: metrics.disputeCount90d,
      chargebackRatePct: Number((chargebackRate * 100).toFixed(2)),
      refundRatePct: Number((refundRate * 100).toFixed(2)),
      failedChargeRatePct: Number((failedRate * 100).toFixed(2)),
      avgTicketSize: Number(metrics.avgTicketSize.toFixed(2)),
      volumeDeltaPct: Number(metrics.volumeDeltaPct.toFixed(2)),
      openDisputeAmount: Number(metrics.openDisputeAmount.toFixed(2)),
    },
  };
}
