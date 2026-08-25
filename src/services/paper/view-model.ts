import type { PaperAccountSnapshot } from "@/services/paper/types";

export function formatPaperMoney(
  value: number | null | undefined,
  options?: { signed?: boolean },
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Unavailable";
  }
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  if (!options?.signed) {
    return value < 0 ? `-${formatted}` : formatted;
  }
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

export function formatPaperPercent(
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
  if (value > 0) return `+${body}`;
  if (value < 0) return `-${body}`;
  return body;
}

export function formatPaperQuantity(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(
    value,
  );
}

export function pnlClass(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value === 0) {
    return "font-mono text-sm";
  }
  return value > 0
    ? "font-mono text-sm text-positive"
    : "font-mono text-sm text-negative";
}

export function accountHasUnavailablePrices(
  account: PaperAccountSnapshot,
): boolean {
  return account.openPositions.some((item) => item.currentPrice === null);
}
