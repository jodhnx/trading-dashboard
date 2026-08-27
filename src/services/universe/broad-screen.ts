import type { CatalogAsset, BroadScreenResult } from "./types";
import type { ProviderRateLimiter } from "@/services/market/rate-limit";
import { DataUnavailableError } from "@/services/market/errors";
import type { MarketDataService } from "@/services/market/market-data-service";

export const DEFAULT_BROAD_SCREEN_LIMIT = 500;
export const DEFAULT_DEEP_ANALYSIS_LIMIT = 150;
export const MIN_LIQUIDITY_VOLUME = 50_000;

/**
 * Stage A — cheap quote-only broad screen.
 * Ranks by momentum/volume/volatility proxies without full technical analysis.
 */
export async function runBroadScreen(input: {
  assets: CatalogAsset[];
  market: MarketDataService;
  limiter: ProviderRateLimiter;
  maxSymbols?: number;
}): Promise<{
  screened: BroadScreenResult[];
  skipped: BroadScreenResult[];
  stats: { screened: number; skipped: number };
}> {
  const max = input.maxSymbols ?? DEFAULT_BROAD_SCREEN_LIMIT;
  const targets = input.assets.slice(0, max);
  const screened: BroadScreenResult[] = [];
  const skipped: BroadScreenResult[] = [];

  for (const asset of targets) {
    if (!input.limiter.canCall()) {
      skipped.push(skipResult(asset, "provider_rate_limit"));
      continue;
    }
    if (!asset.providerMapped || asset.providerSymbol === null) {
      skipped.push(skipResult(asset, "provider_unmapped"));
      continue;
    }
    if (!asset.tradable) {
      skipped.push(skipResult(asset, "non_tradeable"));
      continue;
    }

    try {
      await input.limiter.beforeCall();
      const quoteResult = await input.market.getQuote(asset.symbol);
      const quoteStatus = quoteResult.status;
      const q = quoteResult.quote;
      const changePercent = q?.changePercent ?? 0;
      const volume = q?.volume ?? 0;
      const price = q?.price ?? null;

      if (price === null || !(price > 0)) {
        skipped.push(skipResult(asset, "data_unavailable", quoteStatus));
        continue;
      }

      const signals: string[] = [];
      let screenScore = 0;

      const absChange = Math.abs(changePercent);
      if (absChange >= 3) {
        screenScore += 25;
        signals.push("large_daily_move");
        if (changePercent >= 3) signals.push("new_high");
        if (changePercent <= -3) signals.push("new_low");
      } else if (absChange >= 1.5) {
        screenScore += 15;
        signals.push("momentum_move");
      }

      if (volume >= 5_000_000) {
        screenScore += 20;
        signals.push("high_volume");
      } else if (volume >= 1_000_000) {
        screenScore += 12;
        signals.push("elevated_volume");
      } else if (volume >= MIN_LIQUIDITY_VOLUME) {
        screenScore += 5;
      } else if (asset.liquidityTier !== "HIGH") {
        skipped.push(skipResult(asset, "illiquid", quoteStatus));
        continue;
      }

      if (absChange >= 2 && volume >= 1_000_000) {
        screenScore += 8;
        signals.push("breakout_proximity");
      }

      if (
        asset.category === "SEMICONDUCTOR" ||
        asset.category === "AI" ||
        asset.sector === "Technology"
      ) {
        if (changePercent >= 1.5) {
          screenScore += 4;
          signals.push("sector_strength");
        }
      }

      if (asset.isHighRisk) {
        screenScore += 5;
        signals.push("high_risk_asset");
      }
      if (asset.isLeveragedEtf) {
        screenScore += 8;
        signals.push("leveraged_etf");
      }
      if (asset.assetClass === "CRYPTO") {
        screenScore += absChange * 2;
        if (absChange >= 2) signals.push("crypto_volatility");
      }

      if (asset.liquidityTier === "HIGH") screenScore += 5;

      screened.push({
        symbol: asset.symbol,
        asset,
        quoteStatus,
        price,
        changePercent,
        volume,
        screenScore,
        skipReason: null,
        signals,
      });
    } catch (error) {
      input.limiter.onError(error);
      const reason =
        error instanceof DataUnavailableError
          ? error.details?.reason === "rate_limit"
            ? "provider_rate_limit"
            : `provider_${String(error.details?.reason ?? "error")}`
          : "provider_error";
      skipped.push(skipResult(asset, reason));
    }
  }

  screened.sort((a, b) => b.screenScore - a.screenScore || a.symbol.localeCompare(b.symbol));

  return {
    screened,
    skipped,
    stats: { screened: screened.length, skipped: skipped.length },
  };
}

export function selectDeepAnalysisTargets(
  screened: BroadScreenResult[],
  limit = DEFAULT_DEEP_ANALYSIS_LIMIT,
): BroadScreenResult[] {
  const crypto = screened.filter((s) => s.asset.assetClass === "CRYPTO").slice(0, 25);
  const etf = screened.filter((s) => s.asset.assetClass === "ETF").slice(0, 20);
  const stock = screened
    .filter((s) => s.asset.assetClass === "STOCK")
    .slice(0, limit - crypto.length - etf.length);

  const seen = new Set<string>();
  const merged: BroadScreenResult[] = [];
  for (const item of [...screened.slice(0, limit), ...crypto, ...etf, ...stock]) {
    if (seen.has(item.symbol)) continue;
    seen.add(item.symbol);
    merged.push(item);
    if (merged.length >= limit) break;
  }
  return merged.sort((a, b) => b.screenScore - a.screenScore);
}

function skipResult(
  asset: CatalogAsset,
  reason: string,
  quoteStatus = "UNAVAILABLE",
): BroadScreenResult {
  return {
    symbol: asset.symbol,
    asset,
    quoteStatus,
    price: null,
    changePercent: null,
    volume: null,
    screenScore: 0,
    skipReason: reason,
    signals: [],
  };
}
