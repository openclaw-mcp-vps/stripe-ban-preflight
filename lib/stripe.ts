import Stripe from "stripe";

import type { RiskMetrics } from "@/lib/risk-calculator";

const HIGH_RISK_MCC = new Set([
  "4829", // Wire transfer/money orders
  "5967", // Direct marketing/inbound teleservices
  "5968", // Direct marketing/subscription
  "6051", // Crypto and quasi cash
  "6211", // Securities/brokers
  "7273", // Dating/escort
  "7995", // Betting/gambling
  "5122", // Pharma/supplements
]);

const MEDIUM_RISK_MCC_PREFIX = ["59", "60", "62", "72", "79"];

const POLICY_KEYWORDS = [
  "casino",
  "bet",
  "gambling",
  "crypto",
  "forex",
  "loan",
  "adult",
  "cbd",
  "sweepstake",
  "supplement",
  "gun",
  "weapon",
  "binary options",
];

export interface StripeConnectionPayload {
  stripeAccountId: string;
  accessToken: string;
  refreshToken: string | null;
  livemode: boolean;
  accountEmail: string | null;
}

export interface StripeRiskCollection {
  metrics: RiskMetrics;
  account: {
    accountId: string;
    businessName: string | null;
    payoutsEnabled: boolean;
    currentlyDueCount: number;
  };
}

function getPlatformStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is missing");
  }

  return new Stripe(secretKey);
}

export function buildStripeConnectUrl(state: string, callbackUrl: string): string {
  const clientId = process.env.STRIPE_CLIENT_ID;

  if (!clientId) {
    throw new Error("STRIPE_CLIENT_ID is missing");
  }

  const redirectUri = process.env.STRIPE_REDIRECT_URI ?? callbackUrl;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "read_only",
    state,
    redirect_uri: redirectUri,
  });

  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeStripeCode(
  code: string,
): Promise<StripeConnectionPayload> {
  const stripe = getPlatformStripeClient();
  const tokenResponse = await stripe.oauth.token({
    grant_type: "authorization_code",
    code,
  });

  const oauthError = tokenResponse as {
    error?: unknown;
    error_description?: unknown;
  };

  if (typeof oauthError.error === "string" && oauthError.error.length > 0) {
    throw new Error(
      typeof oauthError.error_description === "string"
        ? oauthError.error_description
        : "Stripe OAuth failed",
    );
  }

  const oauthSuccess = tokenResponse as {
    access_token?: string;
    stripe_user_id?: string;
    refresh_token?: string | null;
    livemode?: boolean;
  };

  if (!oauthSuccess.access_token || !oauthSuccess.stripe_user_id) {
    throw new Error("Stripe OAuth response was missing access token details");
  }

  const connectedClient = new Stripe(oauthSuccess.access_token);
  const account = await connectedClient.accounts.retrieveCurrent();

  return {
    stripeAccountId: oauthSuccess.stripe_user_id,
    accessToken: oauthSuccess.access_token,
    refreshToken: oauthSuccess.refresh_token ?? null,
    livemode: Boolean(oauthSuccess.livemode),
    accountEmail: account.email ?? null,
  };
}

function getMccRiskLabel(mcc: string | null | undefined): RiskMetrics["mccRiskLabel"] {
  if (!mcc) {
    return "medium";
  }

  if (HIGH_RISK_MCC.has(mcc)) {
    return "high";
  }

  if (MEDIUM_RISK_MCC_PREFIX.some((prefix) => mcc.startsWith(prefix))) {
    return "medium";
  }

  return "low";
}

export async function collectStripeRiskMetrics(
  accessToken: string,
): Promise<StripeRiskCollection> {
  const connectedStripe = new Stripe(accessToken);
  const now = Math.floor(Date.now() / 1000);
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60;
  const fortyFiveDaysAgo = now - 45 * 24 * 60 * 60;

  const [account, charges, disputes] = await Promise.all([
    connectedStripe.accounts.retrieveCurrent(),
    connectedStripe.charges.list({ limit: 100, created: { gte: ninetyDaysAgo } }),
    connectedStripe.disputes.list({ limit: 100, created: { gte: ninetyDaysAgo } }),
  ]);

  const chargeList = charges.data;
  const disputeList = disputes.data;

  const chargeCount90d = chargeList.length;
  const disputeCount90d = disputeList.length;
  const refundCount90d = chargeList.filter(
    (charge) => charge.refunded || charge.amount_refunded > 0,
  ).length;
  const failedChargeCount90d = chargeList.filter(
    (charge) => charge.status === "failed",
  ).length;

  const lowValueAttemptCount90d = chargeList.filter(
    (charge) => charge.status !== "succeeded" && charge.amount < 500,
  ).length;

  const totalCapturedCents = chargeList.reduce(
    (sum, charge) => sum + (charge.amount_captured > 0 ? charge.amount_captured : charge.amount),
    0,
  );

  const avgTicketSize = chargeCount90d > 0 ? totalCapturedCents / chargeCount90d / 100 : 0;

  const currentWindowCount = chargeList.filter(
    (charge) => charge.created >= fortyFiveDaysAgo,
  ).length;
  const previousWindowCount = chargeList.filter(
    (charge) => charge.created < fortyFiveDaysAgo,
  ).length;

  const volumeDeltaPct =
    previousWindowCount === 0
      ? 0
      : ((currentWindowCount - previousWindowCount) / previousWindowCount) * 100;

  const openDisputeAmount =
    disputeList
      .filter((dispute) => dispute.status !== "won")
      .reduce((sum, dispute) => sum + dispute.amount, 0) / 100;

  const policyKeywordHits = new Set<string>();

  for (const charge of chargeList) {
    const searchable = [
      charge.description,
      charge.statement_descriptor,
      charge.calculated_statement_descriptor,
      ...Object.values(charge.metadata ?? {}),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    for (const keyword of POLICY_KEYWORDS) {
      if (searchable.includes(keyword)) {
        policyKeywordHits.add(keyword);
      }
    }
  }

  const externalSignals: string[] = [];

  if (!account.payouts_enabled) {
    externalSignals.push("Payouts currently disabled");
  }

  if (!account.charges_enabled) {
    externalSignals.push("Charges not fully enabled");
  }

  const currentlyDueCount = account.requirements?.currently_due?.length ?? 0;
  if (currentlyDueCount > 0) {
    externalSignals.push(`${currentlyDueCount} Stripe requirements currently due`);
  }

  if (disputeCount90d >= 4) {
    externalSignals.push("Dispute count crossed manual review threshold");
  }

  const metrics: RiskMetrics = {
    chargeCount90d,
    disputeCount90d,
    refundCount90d,
    failedChargeCount90d,
    lowValueAttemptCount90d,
    avgTicketSize,
    volumeDeltaPct,
    openDisputeAmount,
    mccRiskLabel: getMccRiskLabel(account.business_profile?.mcc),
    policyKeywordHits: [...policyKeywordHits],
    externalSignals,
  };

  return {
    metrics,
    account: {
      accountId: account.id,
      businessName: account.business_profile?.name ?? account.settings?.dashboard?.display_name ?? null,
      payoutsEnabled: account.payouts_enabled,
      currentlyDueCount,
    },
  };
}

export function constructStripeWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is missing");
  }

  const stripe = getPlatformStripeClient();
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
