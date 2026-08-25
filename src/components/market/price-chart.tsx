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
import type { SerializedCandle } from "@/services/market/serialize";

export function PriceChart({ candles }: { candles: SerializedCandle[] }) {
  const data = candles.map((candle) => ({
    time: new Date(candle.timestamp).toLocaleDateString("de-DE", {
      month: "short",
      day: "numeric",
    }),
    close: candle.close,
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-surface text-sm text-muted">
        MARKET DATA UNAVAILABLE
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
            width={64}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}
          />
          <Line type="monotone" dataKey="close" stroke="var(--accent)" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
