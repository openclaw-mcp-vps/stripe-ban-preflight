import crypto from "node:crypto";

import { lemonSqueezySetup } from "@lemonsqueezy/lemonsqueezy.js";

import type { PurchaseRecord } from "@/lib/db";

let sdkConfigured = false;

export function setupLemonSqueezy() {
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY;

  if (!apiKey || sdkConfigured) {
    return;
  }

  lemonSqueezySetup({ apiKey });
  sdkConfigured = true;
}

export function getLemonCheckoutUrl(): string | null {
  const productId = process.env.NEXT_PUBLIC_LEMON_SQUEEZY_PRODUCT_ID;

  if (!productId) {
    return null;
  }

  const params = new URLSearchParams({
    embed: "1",
    logo: "0",
    media: "0",
    "checkout[custom][source]": "stripe-ban-preflight",
  });

  return `https://checkout.lemonsqueezy.com/buy/${productId}?${params.toString()}`;
}

export function verifyLemonSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;

  if (!secret || !signatureHeader) {
    return false;
  }

  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

type LemonWebhookPayload = {
  meta?: {
    event_name?: string;
  };
  data?: {
    id?: string;
    attributes?: {
      status?: string;
      user_email?: string;
      customer_email?: string;
      first_order_item?: {
        product_name?: string;
      };
    };
  };
};

export function extractPurchaseFromWebhook(
  payload: LemonWebhookPayload,
): PurchaseRecord | null {
  const eventName = payload.meta?.event_name;

  if (!eventName) {
    return null;
  }

  const attrs = payload.data?.attributes;
  const email = attrs?.user_email ?? attrs?.customer_email;

  if (!email) {
    return null;
  }

  if (
    eventName !== "order_created" &&
    eventName !== "subscription_created" &&
    eventName !== "subscription_payment_success"
  ) {
    return null;
  }

  const orderId = payload.data?.id ?? `${eventName}-${Date.now()}`;

  return {
    email: email.toLowerCase().trim(),
    orderId,
    status: eventName === "order_created" ? "paid" : "active",
    source: eventName === "order_created" ? "order" : "subscription",
    createdAt: new Date().toISOString(),
  };
}
