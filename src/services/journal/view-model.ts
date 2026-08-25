import type { JournalEntryRecord } from "./types";

export function formatJournalMoney(
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
  if (!options?.signed) return value < 0 ? `-${formatted}` : formatted;
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

export function formatJournalPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Unavailable";
  }
  return `${value.toFixed(2)}%`;
}

export function formatJournalDate(iso: string | null): string {
  if (!iso) return "Unavailable";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRating(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(1);
}

export function pnlClass(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value === 0) {
    return "font-mono text-sm";
  }
  return value > 0
    ? "font-mono text-sm text-positive"
    : "font-mono text-sm text-negative";
}

export function entryLabel(entry: JournalEntryRecord): string {
  const symbol = entry.symbol ?? "Manual";
  const side = entry.side ?? "—";
  return `${symbol} ${side}`;
}
