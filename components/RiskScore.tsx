"use client";

import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from "recharts";

import type { RiskLevel } from "@/lib/risk-calculator";

interface RiskScoreProps {
  score: number;
  level: RiskLevel;
}

const LEVEL_COPY: Record<RiskLevel, string> = {
  low: "Stable account behavior",
  moderate: "Early warning signals detected",
  high: "Escalation risk is significant",
  critical: "Immediate intervention required",
};

const LEVEL_COLOR: Record<RiskLevel, string> = {
  low: "#2ea043",
  moderate: "#d29922",
  high: "#f0883e",
  critical: "#f85149",
};

export default function RiskScore({ score, level }: RiskScoreProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#161b22] p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#f0f6fc]">Suspension Risk</h3>
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]"
          style={{
            color: LEVEL_COLOR[level],
            backgroundColor: `${LEVEL_COLOR[level]}22`,
          }}
        >
          {level}
        </span>
      </div>

      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            data={[{ name: "risk", value: score }]}
            innerRadius="65%"
            outerRadius="100%"
            startAngle={210}
            endAngle={-30}
            barSize={18}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar
              dataKey="value"
              cornerRadius={14}
              fill={LEVEL_COLOR[level]}
              background={{ fill: "#21262d" }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>

      <div className="-mt-6 text-center">
        <p className="text-4xl font-bold text-[#f0f6fc]">{score}</p>
        <p className="mt-1 text-sm text-[#8b949e]">{LEVEL_COPY[level]}</p>
      </div>
    </section>
  );
}
