import { DataUnavailableError } from "./errors";

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function unixToDate(value: unknown): Date | null {
  const parsed = toNumber(value);
  if (parsed === null) {
    return null;
  }
  const millis = parsed > 10_000_000_000 ? parsed : parsed * 1000;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseTimestamp(value: unknown): Date {
  if (value === null || value === undefined || value === "") {
    throw new DataUnavailableError("DATA UNAVAILABLE", {
      reason: "missing_timestamp",
    });
  }

  const fromUnix = unixToDate(value);
  if (fromUnix) {
    return fromUnix;
  }

  if (typeof value === "string" && value.trim()) {
    const raw = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const dateOnly = new Date(`${raw}T00:00:00.000Z`);
      if (!Number.isNaN(dateOnly.getTime())) {
        return dateOnly;
      }
    }

    const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
    const date = new Date(normalized);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  throw new DataUnavailableError("DATA UNAVAILABLE", {
    reason: "missing_timestamp",
  });
}

export function parseQuoteClock(payload: Record<string, unknown>): Date {
  const lastQuote = unixToDate(payload.last_quote_at);
  if (lastQuote) {
    return lastQuote;
  }

  const timestamp = unixToDate(payload.timestamp);
  const datetime =
    typeof payload.datetime === "string" ? payload.datetime.trim() : "";
  const datetimeHasTime = /\d{2}:\d{2}/.test(datetime);

  if (timestamp && !datetimeHasTime) {
    return timestamp;
  }

  if (payload.datetime !== undefined && payload.datetime !== null && payload.datetime !== "") {
    return parseTimestamp(payload.datetime);
  }

  if (timestamp) {
    return timestamp;
  }

  throw new DataUnavailableError("DATA UNAVAILABLE", {
    reason: "missing_timestamp",
  });
}
