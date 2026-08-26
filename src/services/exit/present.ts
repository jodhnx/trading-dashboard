import type { PositionExitAlert } from "./monitor";

export function exitActionLabel(state: string): string {
  switch (state) {
    case "HOLD":
      return "HOLD";
    case "HOLD_STRONG":
      return "HOLD";
    case "PARTIAL_TAKE_PROFIT":
      return "TAKE PARTIAL PROFIT";
    case "TAKE_PROFIT":
      return "TAKE PROFIT";
    case "STOP_LOSS":
      return "STOP LOSS";
    case "THESIS_INVALIDATED":
      return "THESIS INVALIDATED";
    case "EXIT":
      return "EXIT";
    case "WATCH":
      return "WATCH";
    default:
      return state;
  }
}

/**
 * Stable exit API payload — never fabricates currentPrice.
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
    exitActionLabel: exitActionLabel(alert.evaluation.state),
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
    lastChecked: alert.evaluatedAt,
    dataFreshnessNote:
      "LAST CHECKED from provider quote at evaluation time — not continuous real-time on Hobby cron.",
  };
}

export type ExitCandidate = ReturnType<typeof toExitCandidate>;
