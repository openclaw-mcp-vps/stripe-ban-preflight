import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";

import { DashboardClient } from "@/components/dashboard-client";
import { StripeConnectButton } from "@/components/stripe-connect-button";
import { buttonVariants } from "@/components/ui/button";
import { ACCESS_COOKIE_NAME, STRIPE_CONNECT_COOKIE_NAME, hasPaidAccess } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function singleValue(param: string | string[] | undefined): string | undefined {
  if (!param) {
    return undefined;
  }

  if (Array.isArray(param)) {
    return param[0];
  }

  return param;
}

function unlockMessage(unlockStatus?: string): string | null {
  if (!unlockStatus) {
    return null;
  }

  if (unlockStatus === "success") {
    return "Purchase verified. Dashboard access is now active.";
  }

  if (unlockStatus === "missing") {
    return "Enter your Stripe checkout session ID to verify access.";
  }

  if (unlockStatus === "denied") {
    return "That checkout session was not marked paid. Confirm payment succeeded, then retry.";
  }

  if (unlockStatus === "error") {
    return "Unable to verify checkout right now. Try again or reconnect Stripe credentials.";
  }

  return null;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();

  const hasAccess = hasPaidAccess(cookieStore.get(ACCESS_COOKIE_NAME)?.value);
  const connectedAccountId = cookieStore.get(STRIPE_CONNECT_COOKIE_NAME)?.value ?? null;

  const sessionId = singleValue(params.session_id);
  const unlockStatus = singleValue(params.unlock);
  const connectStatus = singleValue(params.connected);

  const statusMessage = unlockMessage(unlockStatus);

  if (!hasAccess) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-6 py-10 lg:px-10">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "w-fit gap-2 text-muted-foreground hover:text-foreground",
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to landing page
        </Link>

        <section className="space-y-4 rounded-3xl border border-border/70 bg-card/65 p-8">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary uppercase">
            <LockKeyhole className="h-3.5 w-3.5" />
            Paid Access Required
          </div>

          <h1 className="text-3xl font-semibold tracking-tight">Unlock your suspension risk dashboard</h1>
          <p className="max-w-2xl text-muted-foreground">
            This workspace runs the full Stripe risk engine, but dashboard access is gated behind the $19/month
            plan. Complete checkout, then verify your Stripe session to set your access cookie.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ?? ""}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ size: "lg" }),
                "justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              Buy with Stripe Checkout
            </a>
          </div>
        </section>

        <section className="rounded-3xl border border-border/70 bg-card/65 p-8">
          <h2 className="mb-2 text-xl font-semibold">Verify purchase and set access cookie</h2>
          <p className="mb-5 text-sm text-muted-foreground">
            Use the checkout session ID from your Stripe success URL (`cs_...`). Once verified, this browser
            gets secure dashboard access for 30 days.
          </p>

          <form action="/api/access/grant" method="post" className="space-y-4">
            <label className="block text-sm font-medium text-foreground" htmlFor="session_id">
              Stripe checkout session ID
            </label>
            <input
              id="session_id"
              name="session_id"
              defaultValue={sessionId ?? ""}
              required
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none ring-primary transition focus:ring-2"
              placeholder="cs_test_..."
            />

            <button
              type="submit"
              className={cn(
                buttonVariants({ size: "lg" }),
                "rounded-xl bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              Verify and unlock dashboard
            </button>
          </form>

          {statusMessage ? (
            <p className="mt-4 rounded-xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              {statusMessage}
            </p>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-8 lg:px-10">
      <div className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-card/65 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Suspension Risk Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Live analysis of chargebacks, disputes, and account compliance indicators.
          </p>

          {connectStatus === "1" ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Stripe connection updated successfully
            </p>
          ) : null}

          {connectedAccountId ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Connected account: <span className="font-mono text-foreground">{connectedAccountId}</span>
            </p>
          ) : (
            <p className="mt-3 text-xs text-amber-300">
              Connect Stripe to switch from webhook-only telemetry to full live account analysis.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <StripeConnectButton connectedAccountId={connectedAccountId} />
        </div>
      </div>

      <DashboardClient connectedAccountId={connectedAccountId} />
    </main>
  );
}
