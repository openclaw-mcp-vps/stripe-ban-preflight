import { randomBytes } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { STRIPE_CONNECT_COOKIE_NAME } from "@/lib/auth";
import { getStripeServerClient, saveStripeConnection } from "@/lib/stripe-client";

export const runtime = "nodejs";

const OAUTH_STATE_COOKIE = "sbp_stripe_oauth_state";

function getCallbackUrl(request: NextRequest): string {
  const configuredBase = process.env.NEXT_PUBLIC_APP_URL;

  if (configuredBase) {
    return new URL("/api/stripe/connect", configuredBase).toString();
  }

  return new URL("/api/stripe/connect", request.url).toString();
}

function dashboardRedirect(request: NextRequest, status: string): NextResponse {
  const redirectUrl = new URL("/dashboard", request.url);
  redirectUrl.searchParams.set("connect", status);
  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return dashboardRedirect(request, "denied");
  }

  if (!code) {
    const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;

    if (!clientId) {
      return NextResponse.json(
        { error: "Missing STRIPE_CONNECT_CLIENT_ID in environment." },
        { status: 500 },
      );
    }

    const stateToken = randomBytes(24).toString("hex");
    const authorizeUrl = new URL("https://connect.stripe.com/oauth/authorize");

    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("scope", "read_only");
    authorizeUrl.searchParams.set("state", stateToken);
    authorizeUrl.searchParams.set("redirect_uri", getCallbackUrl(request));

    const redirectResponse = NextResponse.redirect(authorizeUrl);
    redirectResponse.cookies.set({
      name: OAUTH_STATE_COOKIE,
      value: stateToken,
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production",
      maxAge: 60 * 10,
      path: "/",
    });

    return redirectResponse;
  }

  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!state || !expectedState || state !== expectedState) {
    return dashboardRedirect(request, "state_mismatch");
  }

  const stripe = getStripeServerClient();
  if (!stripe) {
    return dashboardRedirect(request, "missing_secret");
  }

  try {
    const tokenResponse = await stripe.oauth.token({
      grant_type: "authorization_code",
      code,
    });

    const stripeUserId =
      "stripe_user_id" in tokenResponse ? tokenResponse.stripe_user_id : undefined;

    if (!stripeUserId) {
      return dashboardRedirect(request, "invalid_token");
    }

    const accessToken =
      "access_token" in tokenResponse && typeof tokenResponse.access_token === "string"
        ? tokenResponse.access_token
        : "";
    const refreshToken =
      "refresh_token" in tokenResponse && typeof tokenResponse.refresh_token === "string"
        ? tokenResponse.refresh_token
        : undefined;
    const scope =
      "scope" in tokenResponse && typeof tokenResponse.scope === "string"
        ? tokenResponse.scope
        : undefined;
    const livemode = "livemode" in tokenResponse ? Boolean(tokenResponse.livemode) : false;

    await saveStripeConnection({
      stripeUserId,
      accessToken,
      refreshToken,
      scope,
      livemode,
      connectedAt: new Date().toISOString(),
    });

    const response = NextResponse.redirect(new URL("/dashboard?connected=1", request.url));

    response.cookies.set({
      name: STRIPE_CONNECT_COOKIE_NAME,
      value: stripeUserId,
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  } catch {
    return dashboardRedirect(request, "token_error");
  }
}
