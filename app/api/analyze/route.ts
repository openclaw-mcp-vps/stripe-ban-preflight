import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { ACCESS_COOKIE_NAME, STRIPE_CONNECT_COOKIE_NAME, hasPaidAccess } from "@/lib/auth";
import { analyzeSuspensionRisk } from "@/lib/risk-analyzer";
import { getStripeSignals } from "@/lib/stripe-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function singleParam(value: string | string[] | null): string | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] : value;
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();

  if (!hasPaidAccess(cookieStore.get(ACCESS_COOKIE_NAME)?.value)) {
    return NextResponse.json(
      { error: "Payment required before running risk analysis." },
      { status: 402 },
    );
  }

  const queryAccountId = singleParam(request.nextUrl.searchParams.getAll("account_id"));
  const cookieAccountId = cookieStore.get(STRIPE_CONNECT_COOKIE_NAME)?.value ?? null;
  const accountId = queryAccountId ?? cookieAccountId ?? undefined;

  const signals = await getStripeSignals(accountId);
  const analysis = await analyzeSuspensionRisk(signals);

  return NextResponse.json(analysis, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
