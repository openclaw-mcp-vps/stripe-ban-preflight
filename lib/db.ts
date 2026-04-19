import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  RiskFactor,
  RiskLevel,
  RiskMetricSnapshot,
  RiskRecommendation,
} from "@/lib/risk-calculator";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

export type AIProvider = "rules" | "openai" | "anthropic";

export interface StripeConnection {
  stripeAccountId: string;
  accessToken: string;
  refreshToken: string | null;
  livemode: boolean;
  accountEmail: string | null;
  connectedAt: string;
}

export interface PurchaseRecord {
  email: string;
  orderId: string;
  status: "paid" | "active";
  source: "order" | "subscription";
  createdAt: string;
}

export interface StripeSignal {
  sessionId: string;
  stripeAccountId: string;
  eventType: string;
  summary: string;
  createdAt: string;
}

export interface PersistedAnalysis {
  generatedAt: string;
  provider: AIProvider;
  riskScore: number;
  riskLevel: RiskLevel;
  summary: string;
  factors: RiskFactor[];
  recommendations: RiskRecommendation[];
  complianceFlags: string[];
  metrics: RiskMetricSnapshot;
  account: {
    accountId: string;
    businessName: string | null;
    payoutsEnabled: boolean;
    currentlyDueCount: number;
  };
}

interface StoreShape {
  stripeConnections: Record<string, StripeConnection>;
  purchases: PurchaseRecord[];
  analyses: Record<string, PersistedAnalysis>;
  stripeSignals: StripeSignal[];
}

const EMPTY_STORE: StoreShape = {
  stripeConnections: {},
  purchases: [],
  analyses: {},
  stripeSignals: [],
};

let mutationQueue = Promise.resolve();

async function ensureStoreFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(EMPTY_STORE, null, 2), "utf8");
  }
}

async function readStore(): Promise<StoreShape> {
  await ensureStoreFile();

  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreShape>;

    return {
      stripeConnections: parsed.stripeConnections ?? {},
      purchases: parsed.purchases ?? [],
      analyses: parsed.analyses ?? {},
      stripeSignals: parsed.stripeSignals ?? [],
    };
  } catch {
    return { ...EMPTY_STORE };
  }
}

async function writeStore(store: StoreShape) {
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

async function mutate<T>(operation: (store: StoreShape) => Promise<T> | T): Promise<T> {
  const next = mutationQueue.then(async () => {
    const store = await readStore();
    const result = await operation(store);
    await writeStore(store);
    return result;
  });

  mutationQueue = next.then(
    () => undefined,
    () => undefined,
  );

  return next;
}

export async function saveStripeConnection(
  sessionId: string,
  connection: StripeConnection,
): Promise<void> {
  await mutate((store) => {
    store.stripeConnections[sessionId] = connection;
  });
}

export async function getStripeConnection(
  sessionId: string,
): Promise<StripeConnection | null> {
  const store = await readStore();
  return store.stripeConnections[sessionId] ?? null;
}

export async function findSessionByStripeAccountId(
  stripeAccountId: string,
): Promise<string | null> {
  const store = await readStore();

  for (const [sessionId, connection] of Object.entries(store.stripeConnections)) {
    if (connection.stripeAccountId === stripeAccountId) {
      return sessionId;
    }
  }

  return null;
}

export async function recordPurchase(record: PurchaseRecord): Promise<void> {
  await mutate((store) => {
    const normalizedEmail = record.email.toLowerCase().trim();
    const existingIndex = store.purchases.findIndex(
      (item) => item.orderId === record.orderId || (item.email === normalizedEmail && item.status === record.status),
    );

    const normalizedRecord: PurchaseRecord = {
      ...record,
      email: normalizedEmail,
    };

    if (existingIndex >= 0) {
      store.purchases[existingIndex] = normalizedRecord;
    } else {
      store.purchases.unshift(normalizedRecord);
      store.purchases = store.purchases.slice(0, 5000);
    }
  });
}

export async function hasActivePurchase(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const store = await readStore();

  return store.purchases.some(
    (purchase) => purchase.email === normalizedEmail && (purchase.status === "paid" || purchase.status === "active"),
  );
}

export async function saveAnalysis(
  sessionId: string,
  analysis: PersistedAnalysis,
): Promise<void> {
  await mutate((store) => {
    store.analyses[sessionId] = analysis;
  });
}

export async function getLatestAnalysis(
  sessionId: string,
): Promise<PersistedAnalysis | null> {
  const store = await readStore();
  return store.analyses[sessionId] ?? null;
}

export async function appendStripeSignal(signal: StripeSignal): Promise<void> {
  await mutate((store) => {
    store.stripeSignals.unshift(signal);
    store.stripeSignals = store.stripeSignals.slice(0, 1000);
  });
}

export async function listStripeSignals(
  sessionId: string,
  limit = 20,
): Promise<StripeSignal[]> {
  const store = await readStore();
  return store.stripeSignals
    .filter((signal) => signal.sessionId === sessionId)
    .slice(0, limit);
}
