import type { BacktestResult, BacktestTrade } from "./types";

export function formatBacktestMoney(
  value: number | null | undefined,
  currency = "USD",
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatBacktestPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatBacktestRatio(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(2);
}

export function formatBacktestDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function pnlClass(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) {
    return "font-mono text-sm";
  }
  return value > 0
    ? "font-mono text-sm text-positive"
    : "font-mono text-sm text-negative";
}

export function dataStatusTone(
  status: BacktestResult["dataStatus"],
): "positive" | "accent" | "warning" | "negative" | "neutral" {
  if (status === "LIVE") return "positive";
  if (status === "CACHED") return "accent";
  if (status === "MOCK" || status === "STALE") return "warning";
  if (status === "UNAVAILABLE") return "negative";
  return "neutral";
}

export function exitReasonLabel(reason: BacktestTrade["exitReason"]): string {
  switch (reason) {
    case "STOP_LOSS":
      return "Stop Loss";
    case "TAKE_PROFIT":
      return "Take Profit";
    case "END_OF_DATA":
      return "End of Data";
    default:
      return reason;
  }
}

export function defaultBacktestRange(): { from: string; to: string } {
  const to = new Date("2026-08-24T00:00:00.000Z");
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 400);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}
