import { NextRequest, NextResponse } from "next/server";

import { ACCESS_COOKIE, ACCESS_COOKIE_MAX_AGE_SECONDS } from "@/lib/constants";
import { hasActivePurchase, recordPurchase } from "@/lib/db";
import {
  extractPurchaseFromWebhook,
  setupLemonSqueezy,
  verifyLemonSignature,
} from "@/lib/lemonsqueezy";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  setupLemonSqueezy();

  const signature = request.headers.get("x-signature");
  const rawBody = await request.text();

  if (signature) {
    if (!verifyLemonSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const purchase = extractPurchaseFromWebhook(payload);

    if (purchase) {
      await recordPurchase(purchase);
    }

    return NextResponse.json({ received: true });
  }

  let activationRequest: { email?: string };

  try {
    activationRequest = JSON.parse(rawBody) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid activation payload" }, { status: 400 });
  }

  const email = activationRequest.email?.toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const hasPurchase = await hasActivePurchase(email);

  if (!hasPurchase) {
    return NextResponse.json(
      {
        error:
          "No active purchase found for that email yet. Wait for Lemon Squeezy confirmation and try again.",
      },
      { status: 404 },
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(ACCESS_COOKIE, "granted", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACCESS_COOKIE_MAX_AGE_SECONDS,
  });

  return response;
}
