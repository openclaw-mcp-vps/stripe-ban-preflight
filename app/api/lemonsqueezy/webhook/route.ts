import { NextRequest, NextResponse } from "next/server";

import {
  processLemonSqueezyWebhook,
  setupLemonSqueezyClient,
  verifyLemonSqueezySignature,
} from "@/lib/lemonsqueezy";

export const runtime = "nodejs";

setupLemonSqueezyClient();

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!verifyLemonSqueezySignature(rawBody, request.headers.get("x-signature"))) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as unknown;
  const result = await processLemonSqueezyWebhook(payload);

  if (!result.processed) {
    return NextResponse.json({ error: "Webhook payload missing entitlement fields." }, { status: 400 });
  }

  return NextResponse.json({ received: true, email: result.email });
}
