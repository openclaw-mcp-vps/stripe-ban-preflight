"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BarChart3, RefreshCw, Scale } from "lucide-react";

import { Recommendations } from "@/components/recommendations";
import { RiskScore } from "@/components/risk-score";
import type { RiskAnalysis } from "@/lib/risk-analyzer";

interface DashboardClientProps {
  connectedAccountId: string | null;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function DashboardClient({ connectedAccountId }: DashboardClientProps) {
  const [analysis, setAnalysis] = useState<RiskAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const endpoint = useMemo(() => {
    if (!connectedAccountId) {
      return "/api/analyze";
    }

    const query = new URLSearchParams({ account_id: connectedAccountId });
    return `/api/analyze?${query.toString()}`;
  }, [connectedAccountId]);

  const loadAnalysis = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(endpoint, {
        cache: "no-store",
      });

      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "Unable to load analysis.");
      }

      const payload = (await response.json()) as RiskAnalysis;
      setAnalysis(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load analysis.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [endpoint]);

  useEffect(() => {
    void loadAnalysis();

    const interval = window.setInterval(() => {
      setIsRefreshing(true);
      void loadAnalysis();
    }, 45_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadAnalysis]);

  if (isLoading && !analysis) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/65 p-6 text-sm text-muted-foreground">
        Running risk analysis against your latest Stripe signals...
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="rounded-2xl border border-destructive/60 bg-destructive/10 p-6 text-sm text-destructive">
        <div className="mb-2 flex items-center gap-2 font-semibold">
          <AlertCircle className="h-4 w-4" />
          Analysis unavailable
        </div>
        <p>{error ?? "No analysis data was returned."}</p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-border/70 bg-card/65 p-4">
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Scale className="h-3.5 w-3.5" />
            Chargeback rate
          </p>
          <p className="text-2xl font-semibold">{formatPercent(analysis.metrics.chargebackRate)}</p>
        </article>

        <article className="rounded-2xl border border-border/70 bg-card/65 p-4">
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <BarChart3 className="h-3.5 w-3.5" />
            Refund rate
          </p>
          <p className="text-2xl font-semibold">{formatPercent(analysis.metrics.refundRate)}</p>
        </article>

        <article className="rounded-2xl border border-border/70 bg-card/65 p-4">
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <RefreshCw className="h-3.5 w-3.5" />
            Payment failures
          </p>
          <p className="text-2xl font-semibold">{formatPercent(analysis.metrics.paymentFailureRate)}</p>
        </article>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-200">
          Last refresh warning: {error}
        </div>
      ) : null}

      <RiskScore
        score={analysis.score}
        level={analysis.level}
        trend={analysis.trend}
        generatedAt={analysis.generatedAt}
      />

      <div className="rounded-2xl border border-border/70 bg-card/65 p-5">
        <h2 className="text-lg font-semibold">AI Risk Summary</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{analysis.summary}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          Source: {analysis.modelSource.toUpperCase()} • Data freshness: {analysis.metrics.dataFreshness}
        </p>
      </div>

      <Recommendations recommendations={analysis.topFixes} />

      {isRefreshing ? (
        <p className="text-xs text-muted-foreground">Refreshing analysis with new Stripe events...</p>
      ) : null}
    </section>
  );
}
