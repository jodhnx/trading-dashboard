import type { AnalyticsPreset, ResolvedDateRange } from "./types";

export function parseUtcDate(value: string): Date | null {
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return new Date(parsed);
}

export function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function resolveAnalyticsDateRange(input: {
  preset?: AnalyticsPreset;
  from?: string;
  to?: string;
  referenceDate?: Date;
}): ResolvedDateRange {
  if (input.from || input.to) {
    return {
      preset: "CUSTOM",
      from: input.from ?? null,
      to: input.to ?? null,
    };
  }

  const preset = input.preset ?? "ALL";
  if (preset === "ALL") {
    return { preset, from: null, to: null };
  }

  const end = input.referenceDate ?? new Date("2026-08-24T12:00:00.000Z");
  const start = new Date(end);

  switch (preset) {
    case "7D":
      start.setUTCDate(start.getUTCDate() - 7);
      break;
    case "30D":
      start.setUTCDate(start.getUTCDate() - 30);
      break;
    case "90D":
      start.setUTCDate(start.getUTCDate() - 90);
      break;
    case "1Y":
      start.setUTCFullYear(start.getUTCFullYear() - 1);
      break;
    case "YTD":
      start.setUTCMonth(0, 1);
      start.setUTCHours(0, 0, 0, 0);
      break;
    default:
      break;
  }

  return {
    preset,
    from: formatUtcDate(start),
    to: formatUtcDate(end),
  };
}

export function isTimestampInRange(
  timestamp: string | null,
  range: ResolvedDateRange,
): boolean {
  if (!timestamp) {
    return false;
  }
  const ms = Date.parse(timestamp);
  if (!Number.isFinite(ms)) {
    return false;
  }
  if (range.from) {
    const fromMs = Date.parse(`${range.from}T00:00:00.000Z`);
    if (ms < fromMs) {
      return false;
    }
  }
  if (range.to) {
    const toMs = Date.parse(`${range.to}T23:59:59.999Z`);
    if (ms > toMs) {
      return false;
    }
  }
  return true;
}

export function closedAtBounds(range: ResolvedDateRange): {
  from?: string;
  to?: string;
} {
  return {
    from: range.from ? `${range.from}T00:00:00.000Z` : undefined,
    to: range.to ? `${range.to}T23:59:59.999Z` : undefined,
  };
}
