import "server-only";

import { createMarketDataService } from "@/services/market/create-service";
import { evaluateExitState, type ExitEvaluation } from "@/services/exit/engine";
import type { PositionSide } from "@/types/enums";

export type PositionExitAlert = {
  positionId: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  evaluatedAt: string;
  evaluation: ExitEvaluation;
};

export async function monitorOpenPositions(input: {
  positions: Array<{
    id: string;
    symbol: string;
    side: PositionSide;
    averageEntry: number;
    stopLoss: number | null;
    takeProfit: number | null;
    takeProfit2?: number | null;
  }>;
  now?: Date;
}): Promise<PositionExitAlert[]> {
  const market = createMarketDataService();
  const now = input.now ?? new Date();
  const alerts: PositionExitAlert[] = [];

  for (const position of input.positions) {
    try {
      const quote = await market.getQuote(position.symbol);
      const price = quote.quote?.price ?? null;
      if (
        price === null ||
        (quote.status !== "LIVE" && quote.status !== "CACHED")
      ) {
        continue;
      }
      const technical = await market.getTechnicalSnapshot(position.symbol, "1day");
      const evaluation = evaluateExitState({
        side: position.side,
        entryPrice: position.averageEntry,
        currentPrice: price,
        stopLoss: position.stopLoss,
        takeProfit: position.takeProfit,
        takeProfit2: position.takeProfit2 ?? null,
        trend: technical.snapshot.trend,
        momentum: technical.snapshot.momentum,
        volumeTrend: technical.snapshot.volumeTrend,
      });
      alerts.push({
        positionId: position.id,
        symbol: position.symbol,
        side: position.side,
        entryPrice: position.averageEntry,
        currentPrice: price,
        stopLoss: position.stopLoss,
        takeProfit1: position.takeProfit,
        takeProfit2: position.takeProfit2 ?? null,
        evaluatedAt: now.toISOString(),
        evaluation,
      });
    } catch {
      // Isolate per-position failures
    }
  }

  return alerts.sort((a, b) => {
    const rank = (u: ExitEvaluation["urgency"]) =>
      u === "URGENT_EXIT" ? 0 : u === "TAKE_PROFIT" ? 1 : u === "WATCH" ? 2 : 3;
    return rank(a.evaluation.urgency) - rank(b.evaluation.urgency);
  });
}
