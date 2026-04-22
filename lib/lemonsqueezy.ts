import { createHmac, timingSafeEqual } from "node:crypto";

import { lemonSqueezySetup } from "@lemonsqueezy/lemonsqueezy.js";
import { z } from "zod";

import { readJsonFile, writeJsonFile } from "@/lib/file-store";

const ENTITLEMENTS_FILE = "entitlements.json";

const entitlementRecordSchema = z.object({
  email: z.string().email(),
  status: z.enum(["active", "cancelled", "expired", "paused"]),
  plan: z.string(),
  source: z.literal("lemonsqueezy"),
  updatedAt: z.string(),
});

const entitlementStoreSchema = z.record(entitlementRecordSchema);

const lemonWebhookSchema = z.object({
  meta: z.object({
    event_name: z.string(),
  }),
  data: z.object({
    attributes: z
      .object({
        user_email: z.string().email().optional(),
        customer_email: z.string().email().optional(),
        status: z.string().optional(),
        product_name: z.string().optional(),
        variant_name: z.string().optional(),
      })
      .passthrough(),
  }),
});

type EntitlementStore = z.infer<typeof entitlementStoreSchema>;

export interface LemonWebhookResult {
  processed: boolean;
  email?: string;
}

export function setupLemonSqueezyClient(): void {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;

  if (!apiKey) {
    return;
  }

  lemonSqueezySetup({
    apiKey,
    onError: (error) => {
      console.error("LemonSqueezy SDK error:", error.message);
    },
  });
}

export function verifyLemonSqueezySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

  if (!secret || !signatureHeader) {
    return false;
  }

  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");

  const signature = Buffer.from(signatureHeader, "utf8");
  const expected = Buffer.from(digest, "utf8");

  if (signature.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(signature, expected);
}

async function readEntitlements(): Promise<EntitlementStore> {
  const raw = await readJsonFile<unknown>(ENTITLEMENTS_FILE, {});
  const parsed = entitlementStoreSchema.safeParse(raw);

  return parsed.success ? parsed.data : {};
}

function mapStatus(eventName: string, webhookStatus?: string):
  | "active"
  | "cancelled"
  | "expired"
  | "paused" {
  if (eventName.includes("cancel") || webhookStatus === "cancelled") {
    return "cancelled";
  }

  if (eventName.includes("expired") || webhookStatus === "expired") {
    return "expired";
  }

  if (webhookStatus === "paused") {
    return "paused";
  }

  return "active";
}

export async function processLemonSqueezyWebhook(payload: unknown): Promise<LemonWebhookResult> {
  const parsed = lemonWebhookSchema.safeParse(payload);

  if (!parsed.success) {
    return { processed: false };
  }

  const eventName = parsed.data.meta.event_name;
  const attributes = parsed.data.data.attributes;
  const email = attributes.user_email ?? attributes.customer_email;

  if (!email) {
    return { processed: false };
  }

  const store = await readEntitlements();

  store[email.toLowerCase()] = {
    email: email.toLowerCase(),
    status: mapStatus(eventName, attributes.status),
    plan: [attributes.product_name, attributes.variant_name].filter(Boolean).join(" - ") || "Stripe Ban Preflight",
    source: "lemonsqueezy",
    updatedAt: new Date().toISOString(),
  };

  await writeJsonFile(ENTITLEMENTS_FILE, store);

  return {
    processed: true,
    email: email.toLowerCase(),
  };
}

export async function isEntitledByEmail(email: string): Promise<boolean> {
  const store = await readEntitlements();
  const record = store[email.toLowerCase()];

  if (!record) {
    return false;
  }

  return record.status === "active";
}
