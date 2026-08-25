import { describe, expect, it } from "vitest";
import { buildTechnicalSnapshot } from "./technical-analysis";
import { emaLast } from "../indicators/ema";
import { rsiLast } from "../indicators/rsi";
import { macdLast } from "../indicators/macd";
import { atrLast } from "../indicators/atr";
import type { OhlcvBar } from "../utils/validation";

function barsFromCloses(closes: number[]): OhlcvBar[] {
  return closes.map((close, i) => ({
    timestamp: new Date(Date.UTC(2026, 0, i + 1)),
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1_000,
  }));
}

describe("no look-ahead", () => {
  it("ignores candles after T when building a snapshot at T", () => {
    const past = Array.from({ length: 40 }, (_, i) => 10 + i);
    const future = Array.from({ length: 40 }, (_, i) => 200 + i);
    const all = barsFromCloses([...past, ...future]);
    const asOf = all[39]!.timestamp;

    const withFuture = buildTechnicalSnapshot({
      symbol: "NVDA",
      timeframe: "1day",
      candles: all,
      dataStatus: "LIVE",
      asOf,
    });
    const pastOnly = buildTechnicalSnapshot({
      symbol: "NVDA",
      timeframe: "1day",
      candles: all.slice(0, 40),
      dataStatus: "LIVE",
    });

    expect(withFuture.asOf?.toISOString()).toBe(asOf.toISOString());
    expect(withFuture.currentPrice).toBe(past[past.length - 1]);
    expect(withFuture.currentPrice).not.toBe(future[future.length - 1]);
    expect(withFuture.ema20).toBeCloseTo(pastOnly.ema20!, 12);
    expect(withFuture.rsi14).toBeCloseTo(pastOnly.rsi14!, 12);
    expect(withFuture.macd).toBeCloseTo(pastOnly.macd!, 12);
    expect(withFuture.atr14).toBeCloseTo(pastOnly.atr14!, 12);
    expect(withFuture.ema20).toBeCloseTo(emaLast(past, 20)!, 12);
    expect(withFuture.rsi14).toBeCloseTo(rsiLast(past, 14)!, 12);
    expect(withFuture.macd).toBeCloseTo(macdLast(past).macd!, 12);
    expect(withFuture.atr14).toBeCloseTo(atrLast(all.slice(0, 40))!, 12);
  });

  it("does not treat the last lookback bars as swing pivots", () => {
    const closes = [
      10, 11, 12, 11, 10, 9, 10, 11, 12, 13, 14, 13, 12, 13, 14, 15, 16, 17, 18, 19,
      50,
    ];
    const candles = barsFromCloses(closes);
    const snapshot = buildTechnicalSnapshot({
      symbol: "NVDA",
      timeframe: "1day",
      candles,
      dataStatus: "LIVE",
    });
    expect(
      snapshot.resistanceLevels.every((level) => level.price < 50 + 1),
    ).toBe(true);
    const unconfirmedHigh = candles[candles.length - 1]!.high;
    expect(
      snapshot.resistanceLevels.some(
        (level) => Math.abs(level.price - unconfirmedHigh) < 1e-9,
      ),
    ).toBe(false);
  });
});
