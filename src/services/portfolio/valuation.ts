import type { DataStatus } from "@/services/market/provider";
import type {
  AllocationRow,
  PortfolioSnapshot,
  StoredHolding,
  ValuedHolding,
} from "./types";

export type QuoteForValuation = {
  symbol: string;
  name: string;
  price: number | null;
  dataStatus: DataStatus;
  asOf: string | null;
  source: string | null;
};

function investedValue(quantity: number, averageEntryPrice: number): number {
  return quantity * averageEntryPrice;
}

export function valueHolding(input: {
  holding: StoredHolding;
  name: string;
  quote: QuoteForValuation | null;
}): Omit<ValuedHolding, "allocationPercent"> {
  const invested = investedValue(
    input.holding.quantity,
    input.holding.averageEntryPrice,
  );
  const price = input.quote?.price ?? null;
  const status = input.quote?.dataStatus ?? "UNAVAILABLE";
  const usable =
    price !== null &&
    Number.isFinite(price) &&
    price > 0 &&
    status !== "UNAVAILABLE";

  if (!usable) {
    return {
      id: input.holding.id,
      symbol: input.holding.symbol,
      name: input.name,
      quantity: input.holding.quantity,
      averageEntryPrice: input.holding.averageEntryPrice,
      investedValue: invested,
      currentPrice: null,
      marketValue: null,
      unrealizedPnL: null,
      unrealizedPnLPercent: null,
      dataStatus: "DATA_UNAVAILABLE",
      asOf: input.quote?.asOf ?? null,
      source: input.quote?.source ?? null,
    };
  }

  const marketValue = input.holding.quantity * price;
  const unrealizedPnL = marketValue - invested;
  const unrealizedPnLPercent =
    invested > 0 ? (unrealizedPnL / invested) * 100 : null;

  return {
    id: input.holding.id,
    symbol: input.holding.symbol,
    name: input.name,
    quantity: input.holding.quantity,
    averageEntryPrice: input.holding.averageEntryPrice,
    investedValue: invested,
    currentPrice: price,
    marketValue,
    unrealizedPnL,
    unrealizedPnLPercent,
    dataStatus: status === "MOCK" ? "MOCK" : status,
    asOf: input.quote?.asOf ?? null,
    source: input.quote?.source ?? null,
  };
}

export function aggregateDataStatus(
  statuses: Array<DataStatus | "DATA_UNAVAILABLE">,
): DataStatus | "MIXED" | "DATA_UNAVAILABLE" {
  if (statuses.length === 0) {
    return "DATA_UNAVAILABLE";
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

export function buildPortfolioSnapshot(input: {
  portfolioId: string;
  currency: string;
  cash: number;
  holdings: Array<Omit<ValuedHolding, "allocationPercent">>;
  updatedAt: string;
}): PortfolioSnapshot {
  const totalInvested = input.holdings.reduce(
    (sum, item) => sum + item.investedValue,
    0,
  );

  const marketValues = input.holdings.map((item) => item.marketValue);
  const anyMissingMarket = marketValues.some((value) => value === null);
  const totalMarketValue = anyMissingMarket
    ? null
    : marketValues.reduce<number>((sum, value) => sum + (value ?? 0), 0);

  const totalPortfolioValue =
    totalMarketValue === null ? null : input.cash + totalMarketValue;

  const unrealizedPnL =
    totalMarketValue === null ? null : totalMarketValue - totalInvested;

  const holdings: ValuedHolding[] = input.holdings.map((item) => ({
    ...item,
    allocationPercent:
      totalPortfolioValue !== null &&
      totalPortfolioValue > 0 &&
      item.marketValue !== null
        ? (item.marketValue / totalPortfolioValue) * 100
        : null,
  }));

  const allocation: AllocationRow[] = [
    ...holdings.map((item) => ({
      key: item.symbol,
      label: item.symbol,
      allocationPercent: item.allocationPercent,
      value: item.marketValue,
    })),
    {
      key: "CASH",
      label: "Cash",
      allocationPercent:
        totalPortfolioValue !== null && totalPortfolioValue > 0
          ? (input.cash / totalPortfolioValue) * 100
          : null,
      value: input.cash,
    },
  ];

  return {
    portfolioId: input.portfolioId,
    currency: input.currency,
    cash: input.cash,
    holdings,
    totalInvested,
    totalMarketValue,
    totalPortfolioValue,
    unrealizedPnL,
    realizedPnL: null,
    allocation,
    dataStatus:
      holdings.length === 0
        ? "LIVE"
        : aggregateDataStatus(holdings.map((item) => item.dataStatus)),
    updatedAt: input.updatedAt,
  };
}
