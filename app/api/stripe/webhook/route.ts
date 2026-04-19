import { NextRequest, NextResponse } from "next/server";

import { appendStripeSignal, findSessionByStripeAccountId } from "@/lib/db";
import { constructStripeWebhookEvent } from "@/lib/stripe";

export const runtime = "nodejs";

function summarizeStripeEvent(eventType: string, payload: Record<string, unknown>): string {
  if (eventType === "charge.dispute.created") {
    const amount = typeof payload.amount === "number" ? payload.amount / 100 : 0;
    return `New dispute opened for $${amount.toFixed(2)}`;
  }

  if (eventType === "charge.refunded") {
    const amountRefunded =
      typeof payload.amount_refunded === "number"
        ? payload.amount_refunded / 100
        : 0;
    return `Charge refunded for $${amountRefunded.toFixed(2)}`;
  }

  if (eventType === "charge.failed") {
    return "Charge failed and may indicate fraud or billing friction";
  }

  if (eventType === "account.updated") {
    return "Stripe account settings or requirements changed";
  }

  return eventType;
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  const rawBody = await request.text();

  try {
    const event = constructStripeWebhookEvent(rawBody, signature);
    const eventAccount =
      typeof event.account === "string"
        ? event.account
        : ((event.data.object as { account?: string }).account ?? null);

    if (!eventAccount) {
      return NextResponse.json({ received: true });
    }

    const sessionId = await findSessionByStripeAccountId(eventAccount);

    if (!sessionId) {
      return NextResponse.json({ received: true });
    }

    const eventPayload = event.data.object as unknown as Record<string, unknown>;

    await appendStripeSignal({
      sessionId,
      stripeAccountId: eventAccount,
      eventType: event.type,
      summary: summarizeStripeEvent(event.type, eventPayload),
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }
}
