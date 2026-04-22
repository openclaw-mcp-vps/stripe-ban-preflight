import Link from "next/link";
import {
  AlertOctagon,
  ArrowRight,
  BadgeCheck,
  BanknoteArrowDown,
  Bot,
  CreditCard,
  ShieldAlert,
  TimerReset,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const painPoints = [
  {
    icon: AlertOctagon,
    title: "Bans hit without warning",
    description:
      "Most founders find out after payouts freeze. Revenue can vanish overnight while appeals drag on for weeks.",
  },
  {
    icon: BanknoteArrowDown,
    title: "Chargebacks compound fast",
    description:
      "A short spike in disputes can quietly push your account into Stripe's high-risk review thresholds.",
  },
  {
    icon: TimerReset,
    title: "Manual audits miss patterns",
    description:
      "Spreadsheet checks are too slow. You need a system that flags suspension signals in time to intervene.",
  },
];

const solutionSteps = [
  {
    icon: CreditCard,
    title: "Connect Stripe in read-only mode",
    description:
      "OAuth-based access pulls dispute, refund, and compliance signals without touching charges or customer data writes.",
  },
  {
    icon: Bot,
    title: "AI analyzes suspension triggers",
    description:
      "The engine scores chargeback velocity, payment-failure pressure, account requirement flags, and dispute reason trends.",
  },
  {
    icon: ShieldAlert,
    title: "Execute the top 3 fixes",
    description:
      "Get a prioritized action plan with impact level and exact operational changes to lower ban risk immediately.",
  },
];

const faqs = [
  {
    question: "Is Stripe access truly read-only?",
    answer:
      "Yes. The Connect OAuth flow requests `read_only` scope, so Stripe Ban Preflight can inspect account risk signals without creating or modifying transactions.",
  },
  {
    question: "Who is this built for?",
    answer:
      "SaaS teams above $10k MRR, subscription businesses with rising dispute volume, and higher-risk fintech-adjacent products.",
  },
  {
    question: "How quickly do I get value?",
    answer:
      "Most accounts get an initial risk score and a ranked fix list in under two minutes after connecting Stripe.",
  },
  {
    question: "What if I don't have historical data yet?",
    answer:
      "The dashboard still scores early warning signals from payment failures and account compliance posture, then improves as volume grows.",
  },
];

export default function HomePage() {
  return (
    <div className="relative isolate overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(47,129,247,0.25),transparent_35%)]" />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 lg:px-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/70 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur-sm">
          <BadgeCheck className="h-4 w-4 text-primary" />
          fintech-risk
        </div>

        <Link
          href="/dashboard"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "border-border/80 bg-card/70 text-foreground hover:bg-card",
          )}
        >
          Open Dashboard
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-20 pt-8 lg:px-10">
        <section className="grid gap-8 rounded-3xl border border-border/70 bg-card/60 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-sm lg:grid-cols-[1.3fr_1fr] lg:p-10">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold tracking-wide text-primary uppercase">
              Stripe Ban Preflight
            </p>

            <h1 className="text-balance text-4xl leading-tight font-semibold tracking-tight text-foreground md:text-5xl">
              Predict your Stripe suspension risk before it kills your revenue.
            </h1>

            <p className="max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
              Connect Stripe in read-only mode. We analyze chargebacks, disputes, and compliance signals,
              then return a suspension risk score with the top 3 fixes your team should ship first.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ?? ""}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "justify-center gap-2 rounded-xl bg-primary px-6 text-primary-foreground hover:bg-primary/90",
                )}
              >
                Start for $19/mo
                <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                href="/dashboard"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "justify-center rounded-xl border-border/80 bg-card/70 text-foreground hover:bg-card",
                )}
              >
                View Product Dashboard
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-background/70 p-6">
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              What You Get Every Scan
            </h2>
            <ul className="space-y-4 text-sm text-foreground">
              <li>
                <span className="font-semibold text-primary">Suspension Risk Score:</span> A single number from
                1 to 99 so your team can trend risk weekly.
              </li>
              <li>
                <span className="font-semibold text-primary">Trigger Breakdown:</span> Chargeback ratio,
                payment-failure pressure, and compliance alerts in one view.
              </li>
              <li>
                <span className="font-semibold text-primary">Top 3 Fixes:</span> Prioritized actions with impact
                and execution detail, ready for ops and product owners.
              </li>
            </ul>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-3xl font-semibold tracking-tight">Why founders get suspended</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {painPoints.map(({ icon: Icon, title, description }) => (
              <article
                key={title}
                className="rounded-2xl border border-border/70 bg-card/55 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
              >
                <Icon className="mb-4 h-5 w-5 text-primary" />
                <h3 className="mb-2 text-lg font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-3xl font-semibold tracking-tight">How Stripe Ban Preflight works</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {solutionSteps.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-2xl border border-border/70 bg-card/55 p-6">
                <Icon className="mb-4 h-5 w-5 text-primary" />
                <h3 className="mb-2 text-lg font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/70 to-card/50 p-8 lg:grid-cols-[1.2fr_1fr] lg:p-10">
          <div className="space-y-4">
            <h2 className="text-3xl font-semibold tracking-tight">Simple pricing for high-stakes risk</h2>
            <p className="max-w-xl text-muted-foreground">
              One plan for teams that care about continuity: monitor suspension signals, run weekly risk checks,
              and ship the most critical fixes before Stripe review action hits.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-background/75 p-6">
            <p className="text-sm text-muted-foreground">Growth Plan</p>
            <p className="mt-2 text-4xl font-semibold">$19<span className="text-xl text-muted-foreground">/mo</span></p>
            <ul className="mt-4 space-y-2 text-sm text-foreground">
              <li>Read-only Stripe risk monitoring</li>
              <li>AI-generated suspension score</li>
              <li>Top 3 weekly mitigation recommendations</li>
              <li>Webhook-driven risk event tracking</li>
            </ul>
            <a
              href={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ?? ""}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ size: "lg" }),
                "mt-6 flex w-full justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              Buy with Stripe Checkout
            </a>
          </div>
        </section>

        <section className="space-y-6 pb-8">
          <h2 className="text-3xl font-semibold tracking-tight">FAQ</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {faqs.map((faq) => (
              <article key={faq.question} className="rounded-2xl border border-border/70 bg-card/55 p-6">
                <h3 className="mb-2 text-base font-semibold text-foreground">{faq.question}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
