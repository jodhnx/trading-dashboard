import { normalizeInternalSymbol } from "./symbols";

export type SessionKind = "us_equity" | "crypto" | "metals" | "fx";
export type QuoteOrigin = "provider" | "memory" | "store";

const NY = "America/New_York";

export function sessionKindFor(symbol: string): SessionKind {
  const internal = normalizeInternalSymbol(symbol);
  if (internal === "BTC") {
    return "crypto";
  }
  if (internal === "XAU") {
    return "metals";
  }
  if (internal === "USD") {
    return "fx";
  }
  return "us_equity";
}

function nyClock(now: Date): { weekday: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NY,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);

  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return { weekday, minutes: hour * 60 + minute };
}

export function inferMarketOpen(sessionKind: SessionKind, now: Date): boolean {
  if (sessionKind === "crypto") {
    return true;
  }

  const { weekday, minutes } = nyClock(now);

  if (sessionKind === "us_equity") {
    if (weekday === "Sat" || weekday === "Sun") {
      return false;
    }
    return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
  }

  if (weekday === "Sat") {
    return false;
  }
  if (weekday === "Fri" && minutes >= 17 * 60) {
    return false;
  }
  if (weekday === "Sun" && minutes < 18 * 60) {
    return false;
  }
  return true;
}

export function resolveMarketOpen(
  isMarketOpen: boolean | null | undefined,
  sessionKind: SessionKind,
  now: Date,
): boolean {
  if (typeof isMarketOpen === "boolean") {
    return isMarketOpen;
  }
  return inferMarketOpen(sessionKind, now);
}
