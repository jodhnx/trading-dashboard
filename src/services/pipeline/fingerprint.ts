import { createHash } from "node:crypto";
import type { TradingAnalysisInput } from "@/ai/types";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

export function computeAnalysisFingerprint(
  payload: TradingAnalysisInput,
): string {
  const material = {
    symbol: payload.asset,
    timeframe: payload.timeframe,
    marketData: payload.marketData,
    technicalSnapshot: payload.technicalSnapshot,
    tradingSetup: payload.tradingSetup,
    newsIds: payload.relevantNews.map((item) => item.id).sort(),
  };
  return createHash("sha256").update(stableStringify(material)).digest("hex");
}

export function fingerprintFromSnapshot(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }
  const row = snapshot as { inputFingerprint?: unknown };
  return typeof row.inputFingerprint === "string" ? row.inputFingerprint : null;
}
