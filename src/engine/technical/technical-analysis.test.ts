import { describe, expect, it } from "vitest";
import { buildTechnicalSnapshot } from "./technical-analysis";
import { emaLast } from "../indicators/ema";
import type { OhlcvBar } from "../utils/validation";

function barsFromCloses(
  closes: number[],
  start = Date.UTC(2026, 0, 1),
  volume = 1_000,
): OhlcvBar[] {
  return closes.map((close, i) => ({
    timestamp: new Date(start + i * 86_400_000),
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume,
  }));
}

describe("technical snapshot", () => {
  it("fills indicators from a complete rising series and copies LIVE status", () => {
    const closes = Array.from({ length: 220 }, (_, i) => 50 + i * 0.25);
    const candles = barsFromCloses(closes).map((bar, i) => ({
      ...bar,
      volume: 1_000 + i,
    }));
    const snapshot = buildTechnicalSnapshot({
      symbol: "NVDA",
      timeframe: "1day",
      candles,
      dataStatus: "LIVE",
    });

    expect(snapshot.dataStatus).toBe("LIVE");
    expect(snapshot.dataError).toBeNull();
    expect(snapshot.currentPrice).toBe(closes[closes.length - 1]);
    expect(snapshot.previousClose).toBe(closes[closes.length - 2]);
    expect(snapshot.change).toBeCloseTo(0.25, 12);
    expect(snapshot.ema20).toBeCloseTo(emaLast(closes, 20)!, 12);
    expect(snapshot.ema50).not.toBeNull();
    expect(snapshot.ema200).not.toBeNull();
    expect(snapshot.rsi14).toBeCloseTo(100, 8);
    expect(snapshot.macd).not.toBeNull();
    expect(snapshot.macdSignal).not.toBeNull();
    expect(snapshot.macdHistogram).not.toBeNull();
    expect(snapshot.atr14).not.toBeNull();
    expect(snapshot.volumeRatio).not.toBeNull();
    expect(snapshot.trend).toBe("BULLISH");
    expect(snapshot.asOf?.toISOString()).toBe(
      candles[candles.length - 1]?.timestamp.toISOString(),
    );
  });

  it("returns DATA_UNAVAILABLE without inventing values", () => {
    const snapshot = buildTechnicalSnapshot({
      symbol: "NVDA",
      timeframe: "1day",
      candles: [],
      dataStatus: "LIVE",
    });
    expect(snapshot.dataStatus).toBe("UNAVAILABLE");
    expect(snapshot.dataError).toBe("DATA_UNAVAILABLE");
    expect(snapshot.ema20).toBeNull();
    expect(snapshot.rsi14).toBeNull();
    expect(snapshot.supportLevels).toEqual([]);
    expect(snapshot.resistanceLevels).toEqual([]);
    expect(snapshot.trend).toBe("UNKNOWN");
  });

  it("keeps STALE and MOCK status when candles exist", () => {
    const candles = barsFromCloses(Array.from({ length: 30 }, (_, i) => 10 + i));
    const stale = buildTechnicalSnapshot({
      symbol: "NVDA",
      timeframe: "1h",
      candles,
      dataStatus: "STALE",
    });
    const mock = buildTechnicalSnapshot({
      symbol: "NVDA",
      timeframe: "4h",
      candles,
      dataStatus: "MOCK",
    });
    expect(stale.dataStatus).toBe("STALE");
    expect(mock.dataStatus).toBe("MOCK");
    expect(stale.ema20).not.toBeNull();
    expect(stale.ema200).toBeNull();
  });

  it("leaves indicators null when candles exist but are too few", () => {
    const snapshot = buildTechnicalSnapshot({
      symbol: "BTC",
      timeframe: "1day",
      candles: barsFromCloses([100, 101, 102]),
      dataStatus: "CACHED",
    });
    expect(snapshot.dataStatus).toBe("CACHED");
    expect(snapshot.currentPrice).toBe(102);
    expect(snapshot.ema20).toBeNull();
    expect(snapshot.rsi14).toBeNull();
    expect(snapshot.macd).toBeNull();
    expect(snapshot.atr14).toBeNull();
    expect(snapshot.averageVolume20).toBeNull();
    expect(snapshot.trend).toBe("UNKNOWN");
    expect(snapshot.momentum).toBe("UNKNOWN");
  });

  it("uses the same functions for 1h, 4h, and 1day", () => {
    const candles = barsFromCloses(Array.from({ length: 40 }, (_, i) => 20 + i));
    const hourly = buildTechnicalSnapshot({
      symbol: "NVDA",
      timeframe: "1h",
      candles,
      dataStatus: "LIVE",
    });
    const daily = buildTechnicalSnapshot({
      symbol: "NVDA",
      timeframe: "1day",
      candles,
      dataStatus: "LIVE",
    });
    expect(hourly.ema20).toBeCloseTo(daily.ema20!, 12);
    expect(hourly.rsi14).toBeCloseTo(daily.rsi14!, 12);
    expect(hourly.timeframe).toBe("1h");
    expect(daily.timeframe).toBe("1day");
  });
});
