import type { TechnicalSnapshot } from "../technical/technical-snapshot";
import { emaBearish, emaBullish } from "./score";
import { hasRequiredTechnicalData } from "./validation";
import type { SetupDirection } from "./types";

export const CONFIRMATION_LEVELS = ["STRONG", "CONFIRMED", "WATCH", "NONE"] as const;
export type ConfirmationLevel = (typeof CONFIRMATION_LEVELS)[number];

export const ACTIVE_CONFIRMATION_RULE =
  "trend + momentum + (EMA OR MACD)";
export const LEGACY_CONFIRMATION_RULE =
  "trend + momentum + EMA + MACD";

export type SetupConfirmation = {
  direction: "LONG" | "SHORT" | "NONE";
  confirmation: "STRONG" | "CONFIRMED" | "WATCH";
  trend: string;
  momentum: string;
  ema: "BULLISH" | "BEARISH" | "NONE";
  macd: "POSITIVE" | "NEGATIVE" | "FLAT" | "MISSING";
  atrValid: boolean;
  /** Filled when RR is known from buildTradingSetup; otherwise null until levels exist. */
  rrValid: boolean | null;
  explain: string;
};

function macdLabel(
  snapshot: TechnicalSnapshot,
): "POSITIVE" | "NEGATIVE" | "FLAT" | "MISSING" {
  if (snapshot.macdHistogram === null) return "MISSING";
  if (snapshot.macdHistogram > 0) return "POSITIVE";
  if (snapshot.macdHistogram < 0) return "NEGATIVE";
  return "FLAT";
}

function emaLabel(snapshot: TechnicalSnapshot): "BULLISH" | "BEARISH" | "NONE" {
  if (emaBullish(snapshot)) return "BULLISH";
  if (emaBearish(snapshot)) return "BEARISH";
  return "NONE";
}

export function momentumBullish(snapshot: TechnicalSnapshot): boolean {
  return snapshot.momentum === "POSITIVE" || snapshot.momentum === "STRONG";
}

export function momentumBearish(snapshot: TechnicalSnapshot): boolean {
  return snapshot.momentum === "NEGATIVE" || snapshot.momentum === "WEAK";
}

export function macdPositive(snapshot: TechnicalSnapshot): boolean {
  return snapshot.macdHistogram !== null && snapshot.macdHistogram > 0;
}

export function macdNegative(snapshot: TechnicalSnapshot): boolean {
  return snapshot.macdHistogram !== null && snapshot.macdHistogram < 0;
}

/**
 * Phase 21 confirmation model (Trading Engine source of truth for direction):
 * LONG: BULLISH trend + bullish momentum + (EMA bullish OR MACD positive)
 * SHORT: BEARISH trend + bearish momentum + (EMA bearish OR MACD negative)
 * All four aligned → STRONG; trend+momentum+one confirmer → CONFIRMED.
 */
export function evaluateSetupConfirmation(
  snapshot: TechnicalSnapshot,
): SetupConfirmation {
  const atrValid =
    snapshot.atr14 !== null &&
    snapshot.atr14 > 0 &&
    hasRequiredTechnicalData(snapshot);
  const ema = emaLabel(snapshot);
  const macd = macdLabel(snapshot);
  const base = {
    trend: snapshot.trend,
    momentum: snapshot.momentum,
    ema,
    macd,
    atrValid,
    rrValid: null as boolean | null,
  };

  if (!atrValid) {
    return {
      ...base,
      direction: "NONE",
      confirmation: "WATCH",
      explain: "ATR / required technicals missing",
    };
  }

  const longEma = emaBullish(snapshot);
  const shortEma = emaBearish(snapshot);
  const longMacd = macdPositive(snapshot);
  const shortMacd = macdNegative(snapshot);
  const longMom = momentumBullish(snapshot);
  const shortMom = momentumBearish(snapshot);

  const longStrong =
    snapshot.trend === "BULLISH" && longMom && longEma && longMacd;
  const shortStrong =
    snapshot.trend === "BEARISH" && shortMom && shortEma && shortMacd;

  const longConfirmed =
    snapshot.trend === "BULLISH" && longMom && (longEma || longMacd);
  const shortConfirmed =
    snapshot.trend === "BEARISH" && shortMom && (shortEma || shortMacd);

  if (longStrong && !shortStrong) {
    return {
      ...base,
      direction: "LONG",
      confirmation: "STRONG",
      explain: "Bullish trend + bullish momentum + EMA + MACD (strong confirmation)",
    };
  }
  if (shortStrong && !longStrong) {
    return {
      ...base,
      direction: "SHORT",
      confirmation: "STRONG",
      explain: "Bearish trend + bearish momentum + EMA + MACD (strong confirmation)",
    };
  }
  if (longConfirmed && !shortConfirmed) {
    const via = longEma && longMacd ? "EMA + MACD" : longEma ? "EMA" : "MACD";
    return {
      ...base,
      direction: "LONG",
      confirmation: "CONFIRMED",
      explain: `Bullish trend + bullish momentum + ${via} confirmation`,
    };
  }
  if (shortConfirmed && !longConfirmed) {
    const via = shortEma && shortMacd ? "EMA + MACD" : shortEma ? "EMA" : "MACD";
    return {
      ...base,
      direction: "SHORT",
      confirmation: "CONFIRMED",
      explain: `Bearish trend + bearish momentum + ${via} confirmation`,
    };
  }

  // WATCH / no trade — directional trend without enough confirmation
  if (snapshot.trend === "BULLISH" || snapshot.trend === "BEARISH") {
    const side = snapshot.trend === "BULLISH" ? "bullish" : "bearish";
    if (snapshot.trend === "BULLISH" && !longMom) {
      return {
        ...base,
        direction: "NONE",
        confirmation: "WATCH",
        explain: "Missing bullish momentum",
      };
    }
    if (snapshot.trend === "BEARISH" && !shortMom) {
      return {
        ...base,
        direction: "NONE",
        confirmation: "WATCH",
        explain: "Missing bearish momentum",
      };
    }
    return {
      ...base,
      direction: "NONE",
      confirmation: "WATCH",
      explain: `EMA/MACD confirmation missing (${side} trend + momentum present)`,
    };
  }

  return {
    ...base,
    direction: "NONE",
    confirmation: "WATCH",
    explain: "Trend is not directional",
  };
}

export function confirmationToDirection(
  confirmation: SetupConfirmation,
): SetupDirection {
  if (confirmation.direction === "LONG") return "LONG";
  if (confirmation.direction === "SHORT") return "SHORT";
  return "NO_TRADE";
}

export function confirmationReasons(confirmation: SetupConfirmation): string[] {
  if (confirmation.direction === "LONG" || confirmation.direction === "SHORT") {
    return [confirmation.explain];
  }
  return [confirmation.explain];
}
