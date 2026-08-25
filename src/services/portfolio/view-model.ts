import type { PortfolioSnapshot } from "./types";

/** Client-safe money formatting for portfolio UI. */
export function formatPortfolioMoney(
  value: number | null | undefined,
  currency: string,
  options?: { signed?: boolean },
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Unavailable";
  }
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  if (!options?.signed) {
    return value < 0 ? `-${formatted}` : formatted;
  }
  if (value > 0) {
    return `+${formatted}`;
  }
  if (value < 0) {
    return `-${formatted}`;
  }
  return formatted;
}

export function formatPortfolioPercent(
  value: number | null | undefined,
  options?: { signed?: boolean },
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Unavailable";
  }
  const body = `${Math.abs(value).toFixed(2)}%`;
  if (!options?.signed) {
    return value < 0 ? `-${body}` : body;
  }
  if (value > 0) {
    return `+${body}`;
  }
  if (value < 0) {
    return `-${body}`;
  }
  return body;
}

export function formatPortfolioQuantity(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 8,
  }).format(value);
}

export function portfolioHasUnavailablePrices(
  portfolio: PortfolioSnapshot,
): boolean {
  return portfolio.holdings.some(
    (item) =>
      item.dataStatus === "DATA_UNAVAILABLE" || item.currentPrice === null,
  );
}
