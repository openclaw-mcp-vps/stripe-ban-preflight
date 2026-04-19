import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/constants";
import { saveStripeConnection } from "@/lib/db";
import { buildStripeConnectUrl, exchangeStripeCode } from "@/lib/stripe";

export const runtime = "nodejs";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

function setSessionCookieIfNeeded(
  response: NextResponse,
  existingSession: string | undefined,
  sessionId: string,
) {
  if (existingSession) {
    return;
  }

  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_IN_SECONDS,
  });
}

export async function GET(request: NextRequest) {
  const existingSession = request.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = existingSession ?? randomUUID();

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    const response = NextResponse.redirect(
      new URL(`/dashboard?stripe_error=${encodeURIComponent(error)}`, request.url),
    );
    setSessionCookieIfNeeded(response, existingSession, sessionId);
    return response;
  }

  if (code) {
    if (!state || state !== sessionId) {
      const invalidStateResponse = NextResponse.redirect(
        new URL("/dashboard?stripe_error=invalid_state", request.url),
      );
      setSessionCookieIfNeeded(invalidStateResponse, existingSession, sessionId);
      return invalidStateResponse;
    }

    try {
      const connection = await exchangeStripeCode(code);

      await saveStripeConnection(sessionId, {
        ...connection,
        connectedAt: new Date().toISOString(),
      });

      const successResponse = NextResponse.redirect(
        new URL("/dashboard?stripe=connected", request.url),
      );
      setSessionCookieIfNeeded(successResponse, existingSession, sessionId);
      return successResponse;
    } catch {
      const failedResponse = NextResponse.redirect(
        new URL("/dashboard?stripe_error=oauth_failed", request.url),
      );
      setSessionCookieIfNeeded(failedResponse, existingSession, sessionId);
      return failedResponse;
    }
  }

  if (!process.env.STRIPE_CLIENT_ID || !process.env.STRIPE_SECRET_KEY) {
    const missingConfigResponse = NextResponse.redirect(
      new URL("/dashboard?stripe_error=missing_config", request.url),
    );
    setSessionCookieIfNeeded(missingConfigResponse, existingSession, sessionId);
    return missingConfigResponse;
  }

  const callbackUrl = new URL("/api/stripe/connect", request.url).toString();
  const connectUrl = buildStripeConnectUrl(sessionId, callbackUrl);

  const redirectResponse = NextResponse.redirect(connectUrl);
  setSessionCookieIfNeeded(redirectResponse, existingSession, sessionId);

  return redirectResponse;
}
