import type { BriefTechnicalItem } from "@/services/daily-brief/types";
import type { MarketRegime } from "./types";
import { REGIME_BENCHMARKS } from "./universe";

/**
 * Deterministic market regime from benchmark technicals.
 * Uses SPY/QQQ/IWM/BTC/ETH when present; falls back to provided technicals.
 */
export function detectMarketRegime(
  technicals: Array<Pick<BriefTechnicalItem, "symbol" | "trend" | "volatility" | "dataStatus">>,
): MarketRegime {
  const usable = technicals.filter(
    (item) =>
      item.dataStatus !== "UNAVAILABLE" &&
      item.dataStatus !== "MOCK" &&
      item.trend !== "UNKNOWN",
  );
  if (usable.length === 0) {
    return "UNKNOWN";
  }

  const benchmarks = usable.filter((item) =>
    (REGIME_BENCHMARKS as readonly string[]).includes(item.symbol),
  );
  const pool = benchmarks.length >= 2 ? benchmarks : usable;

  const highVol = pool.filter((item) => item.volatility === "HIGH").length;
  if (highVol >= Math.ceil(pool.length / 2)) {
    return "HIGH_VOLATILITY";
  }

  const bullish = pool.filter((item) => item.trend === "BULLISH").length;
  const bearish = pool.filter((item) => item.trend === "BEARISH").length;
  const neutral = pool.filter((item) => item.trend === "NEUTRAL").length;

  if (bullish >= pool.length * 0.6) {
    return "BULL";
  }
  if (bearish >= pool.length * 0.6) {
    return "BEAR";
  }
  if (neutral >= pool.length * 0.5) {
    return "SIDEWAYS";
  }
  if (bullish > bearish) {
    return "RISK_ON";
  }
  if (bearish > bullish) {
    return "RISK_OFF";
  }
  return "SIDEWAYS";
}

/** Map regime to legacy daily-brief RISK_ON/OFF/MIXED labels for compatibility. */
export function regimeToBriefLabel(regime: MarketRegime): string {
  if (regime === "BULL" || regime === "RISK_ON") return "RISK_ON";
  if (regime === "BEAR" || regime === "RISK_OFF") return "RISK_OFF";
  if (regime === "UNKNOWN") return "UNKNOWN";
  return "MIXED";
}
