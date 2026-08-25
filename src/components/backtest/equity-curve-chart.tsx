"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EquityPoint } from "@/services/backtest/types";
import { formatBacktestDate, formatBacktestMoney } from "@/services/backtest/view-model";

export function EquityCurveChart({
  points,
  currency = "USD",
}: {
  points: EquityPoint[];
  currency?: string;
}) {
  const data = points.map((point) => ({
    time: formatBacktestDate(point.timestamp),
    equity: point.equity,
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-surface text-sm text-muted">
        No equity curve data
      </div>
    );
  }

  return (
    <div className="h-64 w-full rounded-lg border border-border bg-surface p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="time" tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            width={72}
            tickFormatter={(value: number) =>
              formatBacktestMoney(value, currency).replace(/[^\d.,-]/g, "")
            }
          />
          <Tooltip
            formatter={(value) => [
              formatBacktestMoney(typeof value === "number" ? value : Number(value)),
              "Equity",
            ]}
            contentStyle={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}
          />
          <Line
            type="monotone"
            dataKey="equity"
            stroke="var(--accent)"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
