import { SUPPORT_RESISTANCE_THRESHOLDS } from "../technical/thresholds";
import type { OhlcvBar } from "../utils/validation";

export type PriceLevel = {
  price: number;
  strength: number;
  touches: number;
};

/**
 * Deterministic swing support / resistance.
 *
 * A swing high at index i (lookback k) exists when high[i] is strictly greater
 * than every high in (i − k, i + k) except i. Swing lows use the same rule on
 * lows. The last k bars cannot be swings (would require future bars).
 *
 * Nearby swing prices within clusterPct of each other are merged. The level
 * price is the mean of clustered swing prices. touches is the cluster size.
 * strength equals touches (integer, no subjective weighting).
 *
 * Support: clustered lows strictly below currentPrice, nearest first.
 * Resistance: clustered highs strictly above currentPrice, nearest first.
 *
 * Fewer than minCandles bars, or no confirmed swings → empty arrays.
 * Never invents levels.
 */
export function supportResistance(
  bars: readonly OhlcvBar[],
  currentPrice: number,
  options: {
    minCandles?: number;
    swingLookback?: number;
    clusterPct?: number;
    maxLevels?: number;
  } = {},
): { supportLevels: PriceLevel[]; resistanceLevels: PriceLevel[] } {
  const minCandles = options.minCandles ?? SUPPORT_RESISTANCE_THRESHOLDS.minCandles;
  const lookback = options.swingLookback ?? SUPPORT_RESISTANCE_THRESHOLDS.swingLookback;
  const clusterPct = options.clusterPct ?? SUPPORT_RESISTANCE_THRESHOLDS.clusterPct;
  const maxLevels = options.maxLevels ?? SUPPORT_RESISTANCE_THRESHOLDS.maxLevels;

  if (bars.length < minCandles || !Number.isFinite(currentPrice)) {
    return { supportLevels: [], resistanceLevels: [] };
  }

  const highs = bars.map((bar) => bar.high);
  const lows = bars.map((bar) => bar.low);
  const swingHighs = swingIndices(highs, lookback, "high");
  const swingLows = swingIndices(lows, lookback, "low");

  const resistance = clusterLevels(
    swingHighs.map((i) => highs[i]!),
    clusterPct,
  )
    .filter((level) => level.price > currentPrice)
    .sort((a, b) => a.price - b.price)
    .slice(0, maxLevels);

  const support = clusterLevels(
    swingLows.map((i) => lows[i]!),
    clusterPct,
  )
    .filter((level) => level.price < currentPrice)
    .sort((a, b) => b.price - a.price)
    .slice(0, maxLevels);

  return { supportLevels: support, resistanceLevels: resistance };
}

export function swingIndices(
  values: readonly number[],
  lookback: number,
  kind: "high" | "low",
): number[] {
  const indices: number[] = [];
  for (let i = lookback; i < values.length - lookback; i += 1) {
    const pivot = values[i];
    if (pivot === undefined || !Number.isFinite(pivot)) {
      continue;
    }
    let isSwing = true;
    for (let j = i - lookback; j <= i + lookback; j += 1) {
      if (j === i) {
        continue;
      }
      const neighbor = values[j];
      if (neighbor === undefined || !Number.isFinite(neighbor)) {
        isSwing = false;
        break;
      }
      if (kind === "high" && neighbor >= pivot) {
        isSwing = false;
        break;
      }
      if (kind === "low" && neighbor <= pivot) {
        isSwing = false;
        break;
      }
    }
    if (isSwing) {
      indices.push(i);
    }
  }
  return indices;
}

export function clusterLevels(
  prices: readonly number[],
  clusterPct: number,
): PriceLevel[] {
  const sorted = [...prices].filter(Number.isFinite).sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const price of sorted) {
    const last = clusters[clusters.length - 1];
    if (!last) {
      clusters.push([price]);
      continue;
    }
    const anchor = last.reduce((sum, value) => sum + value, 0) / last.length;
    if (anchor !== 0 && Math.abs(price - anchor) / Math.abs(anchor) <= clusterPct) {
      last.push(price);
    } else if (anchor === 0 && Math.abs(price) <= clusterPct) {
      last.push(price);
    } else {
      clusters.push([price]);
    }
  }

  return clusters.map((group) => {
    const price = group.reduce((sum, value) => sum + value, 0) / group.length;
    const touches = group.length;
    return { price, touches, strength: touches };
  });
}
