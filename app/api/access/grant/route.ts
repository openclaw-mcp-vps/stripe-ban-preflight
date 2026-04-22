import { NextRequest, NextResponse } from "next/server";

import { ACCESS_COOKIE_MAX_AGE, ACCESS_COOKIE_NAME } from "@/lib/auth";
import { verifyCheckoutSessionForAccess } from "@/lib/stripe-client";

export const runtime = "nodejs";

function redirectWithStatus(request: NextRequest, status: string): NextResponse {
  const redirectUrl = new URL("/dashboard", request.url);
  redirectUrl.searchParams.set("unlock", status);
  return NextResponse.redirect(redirectUrl);
}

async function grantAccess(
  request: NextRequest,
  sessionId: string | null,
): Promise<NextResponse> {
  if (!sessionId) {
    return redirectWithStatus(request, "missing");
  }

  const verification = await verifyCheckoutSessionForAccess(sessionId.trim());

  if (!verification.granted) {
    return redirectWithStatus(request, "denied");
  }

  const response = redirectWithStatus(request, "success");
  const secureCookie = request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production";

  response.cookies.set({
    name: ACCESS_COOKIE_NAME,
    value: "active",
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie,
    maxAge: ACCESS_COOKIE_MAX_AGE,
    path: "/",
  });

  if (verification.customerEmail) {
    response.cookies.set({
      name: "sbp_customer_email",
      value: verification.customerEmail,
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      maxAge: ACCESS_COOKIE_MAX_AGE,
      path: "/",
    });
  }

  return response;
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  return grantAccess(request, sessionId);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const sessionValue = formData.get("session_id");
  const sessionId = typeof sessionValue === "string" ? sessionValue : null;

  return grantAccess(request, sessionId);
}
