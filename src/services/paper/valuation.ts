import type { DataStatus } from "@/services/market/provider";
import type { PositionSide } from "@/types/enums";
import type { StoredPaperPosition, ValuedPaperPosition } from "./types";
import { unrealizedPnL, marketValue } from "./calculations";

export type QuoteForPaper = {
  symbol: string;
  name: string;
  price: number | null;
  dataStatus: DataStatus;
};

export function valuePaperPosition(input: {
  position: StoredPaperPosition;
  name: string;
  quote: QuoteForPaper | null;
}): ValuedPaperPosition {
  const price = input.quote?.price ?? null;
  const status = input.quote?.dataStatus ?? "UNAVAILABLE";
  const usable =
    price !== null &&
    Number.isFinite(price) &&
    price > 0 &&
    (status === "LIVE" || status === "CACHED");

  if (!usable) {
    return {
      id: input.position.id,
      symbol: input.position.symbol,
      name: input.name,
      side: input.position.side,
      quantity: input.position.quantity,
      entryPrice: input.position.entryPrice,
      currentPrice: null,
      stopLoss: input.position.stopLoss,
      takeProfit: input.position.takeProfit,
      marketValue: null,
      unrealizedPnL: null,
      unrealizedPnLPercent: null,
      dataStatus: "DATA_UNAVAILABLE",
      openedAt: input.position.openedAt,
    };
  }

  const mv = marketValue(price, input.position.quantity);
  const pnl = unrealizedPnL({
    side: input.position.side,
    entryPrice: input.position.entryPrice,
    currentPrice: price,
    quantity: input.position.quantity,
  });
  const invested = input.position.entryPrice * input.position.quantity;
  const pnlPercent = invested > 0 ? (pnl / invested) * 100 : null;

  return {
    id: input.position.id,
    symbol: input.position.symbol,
    name: input.name,
    side: input.position.side,
    quantity: input.position.quantity,
    entryPrice: input.position.entryPrice,
    currentPrice: price,
    stopLoss: input.position.stopLoss,
    takeProfit: input.position.takeProfit,
    marketValue: mv,
    unrealizedPnL: pnl,
    unrealizedPnLPercent: pnlPercent,
    dataStatus: status,
    openedAt: input.position.openedAt,
  };
}

export function aggregatePaperDataStatus(
  statuses: Array<DataStatus | "DATA_UNAVAILABLE">,
): DataStatus | "MIXED" | "DATA_UNAVAILABLE" {
  if (statuses.length === 0) {
    return "LIVE";
  }
  const unique = new Set(statuses);
  if (unique.size === 1) {
    const only = [...unique][0]!;
    return only === "DATA_UNAVAILABLE" ? "DATA_UNAVAILABLE" : only;
  }
  if ([...unique].every((item) => item === "UNAVAILABLE" || item === "DATA_UNAVAILABLE")) {
    return "DATA_UNAVAILABLE";
  }
  return "MIXED";
}

export function sideFromSetupDirection(
  direction: string,
): PositionSide | null {
  if (direction === "LONG" || direction === "SHORT") {
    return direction;
  }
  return null;
}
