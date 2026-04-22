import Stripe from "stripe";
import { z } from "zod";

import { readJsonFile, writeJsonFile } from "@/lib/file-store";

const STRIPE_EVENTS_FILE = "stripe-events.json";
const STRIPE_CONNECTIONS_FILE = "stripe-connections.json";
const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;

const storedStripeEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  created: z.number(),
  account: z.string().optional(),
  disputeReason: z.string().nullable().default(null),
  requirementCount: z.number().int().nonnegative().default(0),
  riskBoost: z.number(),
  receivedAt: z.string(),
});

const storedStripeEventsSchema = z.array(storedStripeEventSchema);

const stripeConnectionSchema = z.object({
  stripeUserId: z.string(),
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  scope: z.string().optional(),
  livemode: z.boolean(),
  connectedAt: z.string(),
});

const stripeConnectionsSchema = z.record(stripeConnectionSchema);

type StoredStripeEvent = z.infer<typeof storedStripeEventSchema>;

type StripeConnections = z.infer<typeof stripeConnectionsSchema>;

export interface StripeConnectionRecord {
  stripeUserId: string;
  accessToken: string;
  refreshToken?: string;
  scope?: string;
  livemode: boolean;
  connectedAt: string;
}

export interface TrendPoint {
  day: string;
  disputes: number;
  riskBoost: number;
}

export interface StripeSignals {
  connectedAccountId: string | null;
  windowDays: number;
  sampleSize: number;
  totalPayments: number;
  disputes: number;
  chargebackRate: number;
  refundRate: number;
  paymentFailureRate: number;
  accountRequirementCount: number;
  pastDueRequirements: number;
  disabledReason: string | null;
  disputeReasons: Record<string, number>;
  trend: TrendPoint[];
  dataFreshness: "live" | "webhook";
  lastUpdated: string;
}

export interface AccessVerificationResult {
  granted: boolean;
  sessionId?: string;
  customerEmail?: string | null;
  reason?: string;
}

let stripeClient: Stripe | null | undefined;

export function getStripeServerClient(): Stripe | null {
  if (stripeClient !== undefined) {
    return stripeClient;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    stripeClient = null;
    return stripeClient;
  }

  stripeClient = new Stripe(secretKey);
  return stripeClient;
}

function clampPercentage(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 1);
}

function baseRiskBoostByEvent(eventType: string): number {
  if (eventType === "charge.dispute.created") {
    return 14;
  }

  if (eventType === "charge.dispute.closed") {
    return -3;
  }

  if (eventType === "payment_intent.payment_failed" || eventType === "charge.failed") {
    return 6;
  }

  if (eventType === "charge.refunded") {
    return 5;
  }

  if (eventType === "account.updated") {
    return 3;
  }

  return 1;
}

function coerceDayLabel(dateIso: string): string {
  return dateIso.slice(5);
}

function buildTrend(events: StoredStripeEvent[], days = 14): TrendPoint[] {
  const trendMap = new Map<string, TrendPoint>();

  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - dayOffset);
    const dayKey = date.toISOString().slice(0, 10);
    trendMap.set(dayKey, {
      day: coerceDayLabel(dayKey),
      disputes: 0,
      riskBoost: 0,
    });
  }

  for (const event of events) {
    const dayKey = new Date(event.created * 1000).toISOString().slice(0, 10);
    const point = trendMap.get(dayKey);

    if (!point) {
      continue;
    }

    if (event.type === "charge.dispute.created") {
      point.disputes += 1;
    }

    point.riskBoost += event.riskBoost;
  }

  return [...trendMap.values()];
}

function hasTrendSignal(trend: TrendPoint[]): boolean {
  return trend.some((point) => point.disputes > 0 || point.riskBoost > 0);
}

async function readStoredEvents(): Promise<StoredStripeEvent[]> {
  const raw = await readJsonFile<unknown>(STRIPE_EVENTS_FILE, []);
  const parsed = storedStripeEventsSchema.safeParse(raw);

  return parsed.success ? parsed.data : [];
}

async function readConnections(): Promise<StripeConnections> {
  const raw = await readJsonFile<unknown>(STRIPE_CONNECTIONS_FILE, {});
  const parsed = stripeConnectionsSchema.safeParse(raw);

  return parsed.success ? parsed.data : {};
}

export async function saveStripeConnection(record: StripeConnectionRecord): Promise<void> {
  const store = await readConnections();

  store[record.stripeUserId] = {
    ...record,
    connectedAt: record.connectedAt,
  };

  await writeJsonFile(STRIPE_CONNECTIONS_FILE, store);
}

export async function getStripeConnection(
  stripeUserId: string,
): Promise<StripeConnectionRecord | null> {
  const store = await readConnections();
  return store[stripeUserId] ?? null;
}

export async function recordStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  const events = await readStoredEvents();

  const normalized: StoredStripeEvent = {
    id: event.id,
    type: event.type,
    created: event.created,
    account: typeof event.account === "string" ? event.account : undefined,
    disputeReason: null,
    requirementCount: 0,
    riskBoost: baseRiskBoostByEvent(event.type),
    receivedAt: new Date().toISOString(),
  };

  const payloadObject = event.data?.object as unknown;
  const payloadRecord =
    typeof payloadObject === "object" && payloadObject !== null
      ? (payloadObject as Record<string, unknown>)
      : null;

  if (event.type === "charge.dispute.created" && payloadRecord) {
    normalized.disputeReason =
      typeof payloadRecord.reason === "string" ? payloadRecord.reason : "unknown";
  }

  if (event.type === "account.updated" && payloadRecord) {
    const requirements =
      typeof payloadRecord.requirements === "object" && payloadRecord.requirements !== null
        ? (payloadRecord.requirements as Record<string, unknown>)
        : undefined;

    const currentlyDue = Array.isArray(requirements?.currently_due)
      ? requirements.currently_due.length
      : 0;

    const pastDue = Array.isArray(requirements?.past_due) ? requirements.past_due.length : 0;

    normalized.requirementCount = currentlyDue + pastDue;
    normalized.riskBoost += Math.min(normalized.requirementCount * 2, 30);
  }

  events.push(normalized);

  await writeJsonFile(STRIPE_EVENTS_FILE, events.slice(-2000));
}

async function getWebhookSignals(accountId?: string): Promise<StripeSignals> {
  const cutoff = Math.floor(Date.now() / 1000) - THIRTY_DAYS_IN_SECONDS;
  const events = await readStoredEvents();
  const filtered = events.filter(
    (event) => event.created >= cutoff && (!accountId || event.account === accountId),
  );

  const chargebacks = filtered.filter((event) => event.type === "charge.dispute.created").length;
  const refunds = filtered.filter((event) => event.type === "charge.refunded").length;
  const failures = filtered.filter(
    (event) =>
      event.type === "payment_intent.payment_failed" || event.type === "charge.failed",
  ).length;

  const observedPayments = Math.max(
    filtered.filter((event) =>
      event.type.startsWith("charge.") || event.type.startsWith("payment_intent."),
    ).length,
    1,
  );

  const disputeReasons: Record<string, number> = {};
  for (const event of filtered) {
    if (!event.disputeReason) {
      continue;
    }

    disputeReasons[event.disputeReason] = (disputeReasons[event.disputeReason] ?? 0) + 1;
  }

  const requirementCount = filtered.reduce(
    (maxValue, event) => Math.max(maxValue, event.requirementCount),
    0,
  );

  return {
    connectedAccountId: accountId ?? null,
    windowDays: 30,
    sampleSize: observedPayments,
    totalPayments: observedPayments,
    disputes: chargebacks,
    chargebackRate: clampPercentage(chargebacks / observedPayments),
    refundRate: clampPercentage(refunds / observedPayments),
    paymentFailureRate: clampPercentage(failures / observedPayments),
    accountRequirementCount: requirementCount,
    pastDueRequirements: 0,
    disabledReason: null,
    disputeReasons,
    trend: buildTrend(filtered),
    dataFreshness: "webhook",
    lastUpdated: new Date().toISOString(),
  };
}

function buildDisputeReasons(disputes: Stripe.Dispute[]): Record<string, number> {
  const reasons: Record<string, number> = {};

  for (const dispute of disputes) {
    const reason = dispute.reason ?? "unknown";
    reasons[reason] = (reasons[reason] ?? 0) + 1;
  }

  return reasons;
}

function buildTrendFromDisputes(disputes: Stripe.Dispute[]): TrendPoint[] {
  const trendMap = new Map<string, TrendPoint>();

  for (let dayOffset = 13; dayOffset >= 0; dayOffset -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - dayOffset);
    const dayKey = date.toISOString().slice(0, 10);
    trendMap.set(dayKey, {
      day: coerceDayLabel(dayKey),
      disputes: 0,
      riskBoost: 0,
    });
  }

  for (const dispute of disputes) {
    const dayKey = new Date(dispute.created * 1000).toISOString().slice(0, 10);
    const point = trendMap.get(dayKey);

    if (!point) {
      continue;
    }

    point.disputes += 1;
    point.riskBoost += 10;
  }

  return [...trendMap.values()];
}

export async function getStripeSignals(accountId?: string): Promise<StripeSignals> {
  const webhookSignals = await getWebhookSignals(accountId);

  const stripe = getStripeServerClient();
  if (!stripe || !accountId) {
    return webhookSignals;
  }

  try {
    const cutoff = Math.floor(Date.now() / 1000) - THIRTY_DAYS_IN_SECONDS;
    const requestOptions: Stripe.RequestOptions = { stripeAccount: accountId };

    const [charges, disputes, paymentIntents, account] = await Promise.all([
      stripe.charges.list({ limit: 100, created: { gte: cutoff } }, requestOptions),
      stripe.disputes.list({ limit: 100, created: { gte: cutoff } }, requestOptions),
      stripe.paymentIntents.list({ limit: 100, created: { gte: cutoff } }, requestOptions),
      stripe.accounts.retrieve(accountId),
    ]);

    const successfulCharges = charges.data.filter((charge) => charge.status === "succeeded").length;
    const refundedCharges = charges.data.filter(
      (charge) => charge.refunded || charge.amount_refunded > 0,
    ).length;

    const failedPayments = paymentIntents.data.filter(
      (intent) => intent.status === "canceled" || intent.status === "requires_payment_method",
    ).length;

    const paymentIntentSample = Math.max(paymentIntents.data.length, 1);
    const chargeSample = Math.max(successfulCharges, 1);

    const accountRequirementCount =
      (account.requirements?.currently_due?.length ?? 0) +
      (account.requirements?.pending_verification?.length ?? 0);

    const pastDueRequirements = account.requirements?.past_due?.length ?? 0;

    const fallbackTrend = hasTrendSignal(webhookSignals.trend)
      ? webhookSignals.trend
      : buildTrendFromDisputes(disputes.data);

    return {
      connectedAccountId: accountId,
      windowDays: 30,
      sampleSize: charges.data.length,
      totalPayments: successfulCharges,
      disputes: disputes.data.length,
      chargebackRate: clampPercentage(disputes.data.length / chargeSample),
      refundRate: clampPercentage(refundedCharges / chargeSample),
      paymentFailureRate: clampPercentage(failedPayments / paymentIntentSample),
      accountRequirementCount,
      pastDueRequirements,
      disabledReason: account.requirements?.disabled_reason ?? null,
      disputeReasons: buildDisputeReasons(disputes.data),
      trend: fallbackTrend,
      dataFreshness: "live",
      lastUpdated: new Date().toISOString(),
    };
  } catch {
    return webhookSignals;
  }
}

export async function verifyCheckoutSessionForAccess(
  sessionId: string,
): Promise<AccessVerificationResult> {
  if (!sessionId || !sessionId.startsWith("cs_")) {
    return {
      granted: false,
      reason: "The checkout session ID format is invalid.",
    };
  }

  const stripe = getStripeServerClient();
  if (!stripe) {
    return {
      granted: false,
      reason: "STRIPE_SECRET_KEY is required to verify purchases.",
    };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const isPaid = session.payment_status === "paid" || session.status === "complete";

    return {
      granted: isPaid,
      sessionId: session.id,
      customerEmail: session.customer_details?.email ?? session.customer_email ?? null,
      reason: isPaid ? undefined : "Stripe has not marked this checkout session as paid yet.",
    };
  } catch {
    return {
      granted: false,
      reason: "Unable to verify the checkout session with Stripe.",
    };
  }
}
