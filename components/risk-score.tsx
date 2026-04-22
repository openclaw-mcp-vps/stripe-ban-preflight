"use client";

import { AlertTriangle } from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { RiskLevel } from "@/lib/risk-analyzer";
import type { TrendPoint } from "@/lib/stripe-client";

interface RiskScoreProps {
  score: number;
  level: RiskLevel;
  trend: TrendPoint[];
  generatedAt: string;
}

function scoreColor(score: number): string {
  if (score >= 75) {
    return "#f85149";
  }

  if (score >= 55) {
    return "#f59e0b";
  }

  if (score >= 30) {
    return "#60a5fa";
  }

  return "#22c55e";
}

export function RiskScore({ score, level, trend, generatedAt }: RiskScoreProps) {
  const color = scoreColor(score);

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <article className="rounded-2xl border border-border/70 bg-card/65 p-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Suspension Risk</h2>
          <span className="rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground">
            Updated {new Date(generatedAt).toLocaleTimeString()}
          </span>
        </div>

        <div className="relative h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[{ name: "risk", value: score }, { name: "buffer", value: 100 - score }]}
                dataKey="value"
                innerRadius={70}
                outerRadius={95}
                startAngle={200}
                endAngle={-20}
                cornerRadius={8}
                stroke="none"
              >
                <Cell fill={color} />
                <Cell fill="#1f2a36" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-4xl font-semibold" style={{ color }}>
              {score}
            </p>
            <p className="text-sm text-muted-foreground">{level} risk</p>
          </div>
        </div>

        <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-primary" />
          Scores above 55 mean Stripe operations changes should be prioritized this week.
        </p>
      </article>

      <article className="rounded-2xl border border-border/70 bg-card/65 p-5">
        <h2 className="mb-3 text-lg font-semibold">14-Day Dispute Trend</h2>

        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="day" stroke="#8b9db2" tickLine={false} axisLine={false} />
              <YAxis stroke="#8b9db2" tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "#111827",
                  border: "1px solid #2d3745",
                  borderRadius: "0.75rem",
                }}
                labelStyle={{ color: "#e6edf3" }}
              />
              <Line
                type="monotone"
                dataKey="disputes"
                stroke="#58a6ff"
                strokeWidth={2}
                dot={{ fill: "#58a6ff", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  );
}
