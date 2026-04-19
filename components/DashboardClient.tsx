"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import RecommendationsList from "@/components/RecommendationsList";
import RiskScore from "@/components/RiskScore";
import type { PersistedAnalysis } from "@/lib/db";

interface DashboardClientProps {
  hasStripeConnection: boolean;
}

export default function DashboardClient({
  hasStripeConnection,
}: DashboardClientProps) {
  const [analysis, setAnalysis] = useState<PersistedAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadAnalysis = useCallback(async (forceRefresh: boolean) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/analyze${forceRefresh ? "?refresh=1" : ""}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Analysis failed");
      }

      const payload = (await response.json()) as PersistedAnalysis;
      setAnalysis(payload);
      setLastUpdated(payload.generatedAt);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Unknown dashboard error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasStripeConnection) {
      return;
    }

    void loadAnalysis(true);

    const interval = setInterval(() => {
      void loadAnalysis(false);
    }, 45_000);

    return () => clearInterval(interval);
  }, [hasStripeConnection, loadAnalysis]);

  const formattedUpdatedAt = useMemo(() => {
    if (!lastUpdated) {
      return null;
    }

    return new Date(lastUpdated).toLocaleString();
  }, [lastUpdated]);

  if (!hasStripeConnection) {
    return (
      <section className="rounded-2xl border border-dashed border-white/20 bg-[#0d1117] p-8 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-[#f0883e]" />
        <h3 className="mt-3 text-lg font-semibold text-[#f0f6fc]">
          Connect Stripe to start preflight analysis
        </h3>
        <p className="mx-auto mt-2 max-w-xl text-sm text-[#9ea7b3]">
          Once connected, we fetch your dispute and charge patterns, score suspension probability,
          and generate the 3 highest-impact fixes.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#161b22] px-5 py-4">
        <div className="flex items-center gap-2 text-sm text-[#9ea7b3]">
          <Clock3 className="h-4 w-4" />
          {formattedUpdatedAt
            ? `Last analysis: ${formattedUpdatedAt}`
            : "No completed analysis yet"}
        </div>

        <button
          type="button"
          onClick={() => void loadAnalysis(true)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#c9d1d9] transition hover:border-[#58a6ff] hover:text-[#58a6ff] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh score
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-[#f85149]/40 bg-[#f85149]/10 p-4 text-sm text-[#ffb0ab]">
          {error}
        </div>
      ) : null}

      {analysis ? (
        <>
          <div className="grid gap-6 lg:grid-cols-[1fr,1.2fr]">
            <RiskScore score={analysis.riskScore} level={analysis.riskLevel} />
            <RecommendationsList recommendations={analysis.recommendations} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Chargeback rate"
              value={`${analysis.metrics.chargebackRatePct}%`}
              hint="Keep under 0.75%"
            />
            <MetricCard
              label="Refund rate"
              value={`${analysis.metrics.refundRatePct}%`}
              hint="Reduce expectation mismatch"
            />
            <MetricCard
              label="Failed charge rate"
              value={`${analysis.metrics.failedChargeRatePct}%`}
              hint="Fraud and billing friction"
            />
            <MetricCard
              label="Open dispute amount"
              value={`$${analysis.metrics.openDisputeAmount.toLocaleString()}`}
              hint="Unresolved exposure"
            />
          </div>

          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-[#161b22] p-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-[#f0f6fc]">
                <BarChart3 className="h-5 w-5 text-[#58a6ff]" />
                Account Summary
              </h3>
              <dl className="mt-4 space-y-2 text-sm text-[#c9d1d9]">
                <div className="flex justify-between gap-4 border-b border-white/5 pb-2">
                  <dt>Business</dt>
                  <dd>{analysis.account.businessName ?? "Not set"}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-white/5 pb-2">
                  <dt>Total charges (90d)</dt>
                  <dd>{analysis.metrics.chargeCount90d}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-white/5 pb-2">
                  <dt>Total disputes (90d)</dt>
                  <dd>{analysis.metrics.disputeCount90d}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-white/5 pb-2">
                  <dt>Average ticket size</dt>
                  <dd>${analysis.metrics.avgTicketSize.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-white/5 pb-2">
                  <dt>Volume trend</dt>
                  <dd>{analysis.metrics.volumeDeltaPct}%</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Provider</dt>
                  <dd className="uppercase tracking-[0.08em] text-[#8b949e]">
                    {analysis.provider}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#161b22] p-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-[#f0f6fc]">
                <AlertTriangle className="h-5 w-5 text-[#f0883e]" />
                Compliance Flags
              </h3>
              <p className="mt-2 text-sm text-[#9ea7b3]">{analysis.summary}</p>

              <ul className="mt-4 space-y-2">
                {analysis.complianceFlags.length > 0 ? (
                  analysis.complianceFlags.map((flag, index) => (
                    <li
                      key={`${flag}-${index}`}
                      className="rounded-lg border border-white/10 bg-[#0d1117] px-3 py-2 text-sm text-[#c9d1d9]"
                    >
                      {flag}
                    </li>
                  ))
                ) : (
                  <li className="rounded-lg border border-white/10 bg-[#0d1117] px-3 py-2 text-sm text-[#9ea7b3]">
                    No immediate compliance alerts detected.
                  </li>
                )}
              </ul>
            </article>
          </section>
        </>
      ) : loading ? (
        <section className="rounded-2xl border border-white/10 bg-[#161b22] p-8 text-center text-sm text-[#9ea7b3]">
          <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-[#58a6ff]" />
          Running Stripe preflight analysis...
        </section>
      ) : null}
    </section>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-xl border border-white/10 bg-[#161b22] p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-[#8b949e]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#f0f6fc]">{value}</p>
      <p className="mt-1 text-xs text-[#9ea7b3]">{hint}</p>
    </article>
  );
}
