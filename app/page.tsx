import Link from "next/link";
import { cookies } from "next/headers";
import {
  AlertTriangle,
  BadgeCheck,
  CircleDollarSign,
  Radar,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import PricingCheckout from "@/components/PricingCheckout";
import { ACCESS_COOKIE } from "@/lib/constants";

const faq = [
  {
    question: "Does this get write access to my Stripe account?",
    answer:
      "No. OAuth scope is read-only. We cannot issue refunds, edit payouts, or modify account settings.",
  },
  {
    question: "How often is the risk score updated?",
    answer:
      "Dashboard analysis refreshes automatically every 45 seconds and can be manually refreshed on demand.",
  },
  {
    question: "What does the score use under the hood?",
    answer:
      "Chargeback ratio, refunds, failed payment anomalies, policy keyword triggers, and Stripe account requirement signals.",
  },
  {
    question: "Who is this built for?",
    answer:
      "SaaS founders above $10k MRR and high-risk payment verticals where a Stripe suspension can halt revenue instantly.",
  },
];

export default async function HomePage() {
  const hasAccess = (await cookies()).get(ACCESS_COOKIE)?.value === "granted";

  return (
    <main className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_15%,rgba(88,166,255,0.24),transparent_38%),radial-gradient(circle_at_80%_0%,rgba(248,81,73,0.20),transparent_28%),linear-gradient(180deg,#0d1117_0%,#0d1117_40%,#121820_100%)]" />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8b949e]">
          Stripe Ban Preflight
        </div>
        <nav className="flex items-center gap-5 text-sm text-[#9ea7b3]">
          <a href="#solution" className="transition hover:text-[#58a6ff]">
            Solution
          </a>
          <a href="#pricing" className="transition hover:text-[#58a6ff]">
            Pricing
          </a>
          <a href="#faq" className="transition hover:text-[#58a6ff]">
            FAQ
          </a>
          <Link
            href={hasAccess ? "/dashboard" : "#pricing"}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#c9d1d9] transition hover:border-[#58a6ff] hover:text-[#58a6ff]"
          >
            {hasAccess ? "Dashboard" : "Get access"}
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-12 px-6 pb-20 pt-8 lg:grid-cols-[1.2fr,1fr]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[#f0883e]/50 bg-[#f0883e]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.13em] text-[#f6b58c]">
            <ShieldAlert className="h-3.5 w-3.5" />
            Predict suspension risk before revenue freezes
          </p>

          <h1 className="mt-5 text-4xl font-bold tracking-tight text-[#f0f6fc] sm:text-5xl">
            Stripe Ban Preflight helps you fix account risk before Stripe does.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#9ea7b3]">
            Connect Stripe in read-only mode. We analyze chargebacks, dispute velocity,
            payment failure patterns, and policy flags to produce a suspension risk score plus
            the three fixes most likely to reduce enforcement risk this week.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Stat title="< 2 min" subtitle="Connect + first score" />
            <Stat title="45 sec" subtitle="Auto refresh interval" />
            <Stat title="Top 3" subtitle="Prioritized remediation actions" />
          </div>
        </div>

        <div id="pricing" className="rounded-2xl border border-white/10 bg-[#161b22]/90 p-6 backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#f0f6fc]">Founder Plan</h2>
            <span className="rounded-full bg-[#1f6feb]/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#58a6ff]">
              fintech-risk
            </span>
          </div>

          <p className="mt-2 text-sm text-[#9ea7b3]">
            For SaaS teams where Stripe uptime is mission-critical.
          </p>

          <div className="mt-4 flex items-end gap-2">
            <span className="text-4xl font-bold text-[#f0f6fc]">$19</span>
            <span className="pb-1 text-sm text-[#9ea7b3]">/month</span>
          </div>

          <ul className="mt-5 space-y-2 text-sm text-[#c9d1d9]">
            <Feature>Live suspension risk score dashboard</Feature>
            <Feature>Dispute and chargeback pattern detection</Feature>
            <Feature>AI compliance analysis (OpenAI/Anthropic)</Feature>
            <Feature>Top 3 fixes ranked by expected impact</Feature>
          </ul>

          <div className="mt-6">
            <PricingCheckout isUnlocked={hasAccess} />
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#11161d]/70 py-14">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 md:grid-cols-3">
          <ProblemCard
            icon={<AlertTriangle className="h-5 w-5 text-[#f85149]" />}
            title="No warning until it is too late"
            description="Suspensions usually arrive after a pattern has already crossed internal thresholds."
          />
          <ProblemCard
            icon={<CircleDollarSign className="h-5 w-5 text-[#f0883e]" />}
            title="Payout interruptions crush runway"
            description="A frozen account can cut cash flow overnight for growth-stage SaaS businesses."
          />
          <ProblemCard
            icon={<Radar className="h-5 w-5 text-[#58a6ff]" />}
            title="Teams lack proactive monitoring"
            description="Most founders only inspect Stripe after a dispute spike or reserve notice."
          />
        </div>
      </section>

      <section id="solution" className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#58a6ff]">
            How it works
          </p>
          <h2 className="mt-2 text-3xl font-bold text-[#f0f6fc]">
            Read-only Stripe telemetry translated into a clear risk plan.
          </h2>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <SolutionCard
            step="1"
            title="Connect Stripe"
            detail="OAuth read-only permissions pull disputes, charges, and account health signals safely."
          />
          <SolutionCard
            step="2"
            title="Model + AI analysis"
            detail="Rules engine scores enforcement risk while OpenAI/Anthropic expands contextual recommendations."
          />
          <SolutionCard
            step="3"
            title="Fix highest-impact gaps"
            detail="Prioritized actions focus on dispute reduction, policy clarity, and payment hygiene in 7 days."
          />
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-6 px-6 pb-16 md:grid-cols-3">
        <HighlightCard
          icon={<BadgeCheck className="h-5 w-5 text-[#2ea043]" />}
          title="Actionable, not vanity metrics"
          detail="Every recommendation includes why it matters and what to change in operations or checkout flows."
        />
        <HighlightCard
          icon={<Sparkles className="h-5 w-5 text-[#58a6ff]" />}
          title="Built for high-MRR SaaS"
          detail="Optimized for founder teams that cannot afford payment downtime or payout uncertainty."
        />
        <HighlightCard
          icon={<ShieldAlert className="h-5 w-5 text-[#f0883e]" />}
          title="Preflight before enforcement"
          detail="See trouble early enough to remediate before Stripe forces reserves or account restrictions."
        />
      </section>

      <section id="faq" className="mx-auto w-full max-w-4xl px-6 pb-20">
        <h2 className="text-2xl font-bold text-[#f0f6fc]">FAQ</h2>
        <div className="mt-5 space-y-3">
          {faq.map((item) => (
            <article
              key={item.question}
              className="rounded-xl border border-white/10 bg-[#161b22] p-4"
            >
              <h3 className="text-sm font-semibold text-[#f0f6fc]">{item.question}</h3>
              <p className="mt-2 text-sm text-[#9ea7b3]">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function Stat({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#161b22] p-4">
      <p className="text-2xl font-semibold text-[#f0f6fc]">{title}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[#8b949e]">{subtitle}</p>
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1 h-2 w-2 rounded-full bg-[#2ea043]" />
      <span>{children}</span>
    </li>
  );
}

function ProblemCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-xl border border-white/10 bg-[#161b22] p-5">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/5">
        {icon}
      </div>
      <h3 className="mt-3 text-lg font-semibold text-[#f0f6fc]">{title}</h3>
      <p className="mt-2 text-sm text-[#9ea7b3]">{description}</p>
    </article>
  );
}

function SolutionCard({
  step,
  title,
  detail,
}: {
  step: string;
  title: string;
  detail: string;
}) {
  return (
    <article className="rounded-xl border border-white/10 bg-[#161b22] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#58a6ff]">
        Step {step}
      </p>
      <h3 className="mt-2 text-lg font-semibold text-[#f0f6fc]">{title}</h3>
      <p className="mt-2 text-sm text-[#9ea7b3]">{detail}</p>
    </article>
  );
}

function HighlightCard({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <article className="rounded-xl border border-white/10 bg-[#161b22] p-5">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/5">
        {icon}
      </div>
      <h3 className="mt-3 text-lg font-semibold text-[#f0f6fc]">{title}</h3>
      <p className="mt-2 text-sm text-[#9ea7b3]">{detail}</p>
    </article>
  );
}
