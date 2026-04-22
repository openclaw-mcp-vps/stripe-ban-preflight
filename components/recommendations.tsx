"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink, X } from "lucide-react";

import type { RiskRecommendation } from "@/lib/risk-analyzer";

interface RecommendationsProps {
  recommendations: RiskRecommendation[];
}

function badgeColor(impact: RiskRecommendation["impact"]): string {
  if (impact === "High") {
    return "bg-red-500/15 text-red-300 border-red-400/40";
  }

  if (impact === "Medium") {
    return "bg-amber-500/15 text-amber-300 border-amber-400/40";
  }

  return "bg-blue-500/15 text-blue-300 border-blue-400/40";
}

export function Recommendations({ recommendations }: RecommendationsProps) {
  return (
    <section className="space-y-3 rounded-2xl border border-border/70 bg-card/65 p-5">
      <div>
        <h2 className="text-lg font-semibold">Top 3 Fixes</h2>
        <p className="text-sm text-muted-foreground">
          Prioritized actions to reduce suspension probability before your next billing cycle.
        </p>
      </div>

      <div className="space-y-3">
        {recommendations.map((recommendation) => (
          <Dialog.Root key={recommendation.title}>
            <article className="rounded-xl border border-border/70 bg-background/55 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">{recommendation.title}</h3>
                <span
                  className={`rounded-full border px-2 py-1 text-xs font-medium ${badgeColor(recommendation.impact)}`}
                >
                  {recommendation.impact} Impact
                </span>
              </div>

              <p className="line-clamp-2 text-sm text-muted-foreground">{recommendation.actionPlan}</p>

              <Dialog.Trigger asChild>
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary transition hover:text-primary/80"
                >
                  View implementation playbook
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </Dialog.Trigger>
            </article>

            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
              <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-[#0f1724] p-6 shadow-2xl">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <Dialog.Title className="text-lg leading-tight font-semibold">
                    {recommendation.title}
                  </Dialog.Title>

                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="rounded-md border border-border/70 p-1 text-muted-foreground transition hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </Dialog.Close>
                </div>

                <div className="space-y-4 text-sm">
                  <div>
                    <p className="mb-1 font-semibold text-foreground">Why this matters</p>
                    <p className="text-muted-foreground">{recommendation.whyItMatters}</p>
                  </div>

                  <div>
                    <p className="mb-1 font-semibold text-foreground">Action plan</p>
                    <p className="text-muted-foreground">{recommendation.actionPlan}</p>
                  </div>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        ))}
      </div>
    </section>
  );
}
