import type { PositionExitAlert } from "./monitor";

/**
 * Stable exit API payload — never fabricates currentPrice (caller must supply real quotes).
 */
export function toExitCandidate(alert: PositionExitAlert) {
  const unrealizedPct = alert.evaluation.unrealizedPnLPercent;
  const unrealizedPnL =
    unrealizedPct !== null
      ? (alert.entryPrice * unrealizedPct) / 100
      : null;

  const distanceToTP1 =
    alert.takeProfit1 !== null && alert.currentPrice > 0
      ? (Math.abs(alert.takeProfit1 - alert.currentPrice) / alert.currentPrice) *
        100
      : null;
  const distanceToTP2 =
    alert.takeProfit2 !== null && alert.currentPrice > 0
      ? (Math.abs(alert.takeProfit2 - alert.currentPrice) / alert.currentPrice) *
        100
      : null;
  const distanceToStop =
    alert.evaluation.distanceToStopPercent ??
    (alert.stopLoss !== null && alert.currentPrice > 0
      ? (Math.abs(alert.stopLoss - alert.currentPrice) / alert.currentPrice) * 100
      : null);

  return {
    positionId: alert.positionId,
    symbol: alert.symbol,
    side: alert.side,
    exitAction: alert.evaluation.state,
    exitUrgency: alert.evaluation.urgency,
    currentPrice: alert.currentPrice,
    entryPrice: alert.entryPrice,
    unrealizedPnL,
    unrealizedPnLPercent: unrealizedPct,
    distanceToStop,
    distanceToTP1,
    distanceToTP2,
    thesisStatus: alert.evaluation.state,
    exitReason: alert.evaluation.reasons[0] ?? "No exit reason",
    stopLoss: alert.stopLoss,
    takeProfit1: alert.takeProfit1,
    takeProfit2: alert.takeProfit2,
    trailingStop: alert.evaluation.trailingStop,
    evaluatedAt: alert.evaluatedAt,
  };
}

export type ExitCandidate = ReturnType<typeof toExitCandidate>;
