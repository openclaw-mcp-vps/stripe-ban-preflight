import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";

import DashboardClient from "@/components/DashboardClient";
import StripeConnect from "@/components/StripeConnect";
import { ACCESS_COOKIE, SESSION_COOKIE } from "@/lib/constants";
import { getStripeConnection } from "@/lib/db";

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const cookieStore = await cookies();
  const hasAccess = cookieStore.get(ACCESS_COOKIE)?.value === "granted";

  if (!hasAccess) {
    redirect("/?paywall=locked");
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const stripeError =
    typeof resolvedParams.stripe_error === "string"
      ? resolvedParams.stripe_error
      : null;

  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  const stripeConnection = sessionId
    ? await getStripeConnection(sessionId)
    : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#58a6ff]">
            Stripe Ban Preflight
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[#f0f6fc]">Suspension Risk Dashboard</h1>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-[#c9d1d9] transition hover:border-[#58a6ff] hover:text-[#58a6ff]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to landing page
        </Link>
      </div>

      {stripeError ? (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-[#f85149]/40 bg-[#f85149]/10 p-4 text-sm text-[#ffb0ab]">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          Stripe connect error: {stripeError.replaceAll("_", " ")}
        </div>
      ) : null}

      <div className="space-y-6">
        <StripeConnect connectedAccountId={stripeConnection?.stripeAccountId ?? null} />
        <DashboardClient hasStripeConnection={Boolean(stripeConnection)} />
      </div>
    </main>
  );
}
