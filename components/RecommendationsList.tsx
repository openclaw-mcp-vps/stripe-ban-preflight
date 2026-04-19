import { ArrowRight, Wrench } from "lucide-react";

import type { RiskRecommendation } from "@/lib/risk-calculator";

interface RecommendationsListProps {
  recommendations: RiskRecommendation[];
}

export default function RecommendationsList({
  recommendations,
}: RecommendationsListProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#161b22] p-6">
      <div className="mb-5 flex items-center gap-2">
        <Wrench className="h-5 w-5 text-[#58a6ff]" />
        <h3 className="text-lg font-semibold text-[#f0f6fc]">Top 3 Fixes</h3>
      </div>

      <div className="space-y-4">
        {recommendations.map((recommendation, index) => (
          <article
            key={`${recommendation.title}-${index}`}
            className="rounded-xl border border-white/10 bg-[#0d1117] p-4"
          >
            <p className="text-xs uppercase tracking-[0.12em] text-[#8b949e]">
              Fix {index + 1}
            </p>
            <h4 className="mt-1 text-base font-semibold text-[#f0f6fc]">
              {recommendation.title}
            </h4>
            <p className="mt-2 text-sm text-[#9ea7b3]">
              {recommendation.whyItMatters}
            </p>
            <p className="mt-3 flex items-start gap-2 text-sm text-[#c9d1d9]">
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[#58a6ff]" />
              {recommendation.action}
            </p>
            <p className="mt-3 text-xs text-[#8b949e]">
              Expected impact: {recommendation.expectedImpact}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
