import type Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

import { getStripeServerClient, recordStripeWebhookEvent } from "@/lib/stripe-client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const stripe = getStripeServerClient();

  let event: Stripe.Event;

  try {
    if (stripe && process.env.STRIPE_WEBHOOK_SECRET && signature) {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } else {
      event = JSON.parse(rawBody) as Stripe.Event;
    }

    await recordStripeWebhookEvent(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
