import type { PaperCloseReason } from "@/types/database";
import type { AnalyticsViewModel } from "./types";

export function formatAnalyticsMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatAnalyticsPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  const sign = normalized > 0 ? "+" : "";
  return `${sign}${normalized.toFixed(1)}%`;
}

export function formatAnalyticsRatio(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(2);
}

export function formatAnalyticsDate(value: string | null | undefined): string {
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

export function exitReasonLabel(reason: PaperCloseReason): string {
  switch (reason) {
    case "MANUAL":
      return "Manual";
    case "STOP_LOSS":
      return "Stop Loss";
    case "TAKE_PROFIT":
      return "Take Profit";
    default:
      return reason;
  }
}

export function presetLabel(preset: AnalyticsViewModel["filters"]["preset"]): string {
  if (preset === "CUSTOM") {
    return "Custom";
  }
  return preset;
}

export function winRateLabel(value: number | null): string {
  if (value === null) {
    return "—";
  }
  const percent = value <= 1 ? value * 100 : value;
  return `${percent.toFixed(1)}%`;
}
