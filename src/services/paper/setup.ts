import type { TradingSetup } from "@/engine/trading/types";
import type { TechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import type { PaperSetupSnapshot } from "./types";

export function buildSetupSnapshot(input: {
  setup: TradingSetup;
  snapshot: TechnicalSnapshot;
}): PaperSetupSnapshot {
  return {
    symbol: input.setup.symbol,
    timeframe: input.setup.timeframe,
    direction: input.setup.direction as PaperSetupSnapshot["direction"],
    score: input.setup.score,
    entry: input.setup.entry!,
    stopLoss: input.setup.stopLoss!,
    takeProfit: input.setup.takeProfit!,
    riskReward: input.setup.riskReward,
    riskAmount: input.setup.riskAmount!,
    positionSize: input.setup.positionSize!,
    positionValue: input.setup.positionValue!,
    dataStatus: input.setup.dataStatus,
    technicalCondition: input.snapshot.technicalCondition ?? null,
    createdAt: input.setup.createdAt.toISOString(),
  };
}

export function isPaperTradeableSetup(setup: TradingSetup): {
  ok: true;
} | {
  ok: false;
  reason: string;
} {
  if (setup.direction === "NO_TRADE") {
    return { ok: false, reason: "Setup direction is NO_TRADE." };
  }
  if (setup.status !== "VALID") {
    return {
      ok: false,
      reason: `Setup status is ${setup.status}. Only VALID setups can open paper trades.`,
    };
  }
  if (
    setup.dataStatus === "STALE" ||
    setup.dataStatus === "MOCK" ||
    setup.dataStatus === "UNAVAILABLE"
  ) {
    return {
      ok: false,
      reason: `Market data status ${setup.dataStatus} cannot be used for paper trades.`,
    };
  }
  const required = [
    setup.entry,
    setup.stopLoss,
    setup.takeProfit,
    setup.positionSize,
    setup.positionValue,
    setup.riskAmount,
  ];
  if (required.some((value) => value === null || !Number.isFinite(value) || value <= 0)) {
    return { ok: false, reason: "Setup is missing required trade levels or size." };
  }
  return { ok: true };
}
