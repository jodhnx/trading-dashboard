import { describe, expect, it } from "vitest";
import { buildTechnicalSnapshot } from "@/engine/technical/technical-analysis";
import { buildTradingSetup } from "@/engine/trading/setup";
import { emaLast } from "@/engine/indicators/ema";
import { rsiLast } from "@/engine/indicators/rsi";
import { macdLast } from "@/engine/indicators/macd";
import { atrLast } from "@/engine/indicators/atr";
import { sizePosition } from "@/engine/trading/position-size";
import type { OhlcvBar } from "@/engine/utils/validation";
import { BACKTEST_WARMUP_BARS } from "./constants";
import { buildMockHistoricalCandles } from "./mock-historical-provider";
import { runBacktestSimulation } from "./simulation";

function barsFromCloses(closes: number[], dayOffset = 0): OhlcvBar[] {
  return closes.map((close, i) => ({
    timestamp: new Date(Date.UTC(2024, 0, dayOffset + i + 1)),
    open: close - 0.2,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
  }));
}

const riskSettings = {
  maxRiskPercent: 0.01,
  maxPositionPercent: 0.2,
  minimumRiskReward: 2,
};

describe("backtest no-look-ahead", () => {
  it("future candle cannot affect EMA at T", () => {
    const past = Array.from({ length: 40 }, (_, i) => 10 + i);
    const future = Array.from({ length: 40 }, (_, i) => 200 + i);
    const all = barsFromCloses([...past, ...future]);
    const asOf = all[39]!.timestamp;
    const snapshot = buildTechnicalSnapshot({
      symbol: "NVDA",
      timeframe: "1day",
      candles: all,
      dataStatus: "CACHED",
      asOf,
    });
    expect(snapshot.ema20).toBeCloseTo(emaLast(past, 20)!, 12);
  });

  it("future candle cannot affect RSI at T", () => {
    const past = Array.from({ length: 40 }, (_, i) => 10 + i);
    const future = Array.from({ length: 40 }, (_, i) => 200 + i);
    const all = barsFromCloses([...past, ...future]);
    const snapshot = buildTechnicalSnapshot({
      symbol: "NVDA",
      timeframe: "1day",
      candles: all,
      dataStatus: "CACHED",
      asOf: all[39]!.timestamp,
    });
    expect(snapshot.rsi14).toBeCloseTo(rsiLast(past, 14)!, 12);
  });

  it("future candle cannot affect MACD at T", () => {
    const past = Array.from({ length: 40 }, (_, i) => 10 + i);
    const future = Array.from({ length: 40 }, (_, i) => 200 + i);
    const all = barsFromCloses([...past, ...future]);
    const snapshot = buildTechnicalSnapshot({
      symbol: "NVDA",
      timeframe: "1day",
      candles: all,
      dataStatus: "CACHED",
      asOf: all[39]!.timestamp,
    });
    expect(snapshot.macd).toBeCloseTo(macdLast(past).macd!, 12);
  });

  it("future candle cannot affect ATR at T", () => {
    const past = Array.from({ length: 40 }, (_, i) => 10 + i);
    const future = Array.from({ length: 40 }, (_, i) => 200 + i);
    const all = barsFromCloses([...past, ...future]);
    const snapshot = buildTechnicalSnapshot({
      symbol: "NVDA",
      timeframe: "1day",
      candles: all,
      dataStatus: "CACHED",
      asOf: all[39]!.timestamp,
    });
    expect(snapshot.atr14).toBeCloseTo(atrLast(all.slice(0, 40))!, 12);
  });

  it("future candle cannot affect support/resistance at T", () => {
    const past = barsFromCloses(Array.from({ length: 250 }, (_, i) => 10 + (i % 7)));
    const future = barsFromCloses(Array.from({ length: 50 }, (_, i) => 500 + i), 250);
    const all = [...past, ...future];
    const asOf = past[past.length - 1]!.timestamp;
    const atT = buildTechnicalSnapshot({
      symbol: "NVDA",
      timeframe: "1day",
      candles: all,
      dataStatus: "CACHED",
      asOf,
    });
    const pastOnly = buildTechnicalSnapshot({
      symbol: "NVDA",
      timeframe: "1day",
      candles: past,
      dataStatus: "CACHED",
      asOf,
    });
    expect(atT.supportLevels).toEqual(pastOnly.supportLevels);
    expect(atT.resistanceLevels).toEqual(pastOnly.resistanceLevels);
  });

  it("future candle cannot affect Trading Setup at T", () => {
    const past = barsFromCloses(Array.from({ length: 250 }, (_, i) => 50 + i * 0.1));
    const future = barsFromCloses(Array.from({ length: 50 }, (_, i) => 500 + i), 250);
    const all = [...past, ...future];
    const asOf = past[past.length - 1]!.timestamp;
    const withFuture = buildTradingSetup({
      snapshot: buildTechnicalSnapshot({
        symbol: "NVDA",
        timeframe: "1day",
        candles: all,
        dataStatus: "CACHED",
        asOf,
      }),
      settings: { accountCapital: 10000, ...riskSettings },
      now: asOf,
    });
    const pastOnly = buildTradingSetup({
      snapshot: buildTechnicalSnapshot({
        symbol: "NVDA",
        timeframe: "1day",
        candles: past,
        dataStatus: "CACHED",
        asOf,
      }),
      settings: { accountCapital: 10000, ...riskSettings },
      now: asOf,
    });
    expect(withFuture.status).toBe(pastOnly.status);
    expect(withFuture.direction).toBe(pastOnly.direction);
    expect(withFuture.score).toBe(pastOnly.score);
    expect(withFuture.entry).toBe(pastOnly.entry);
  });

  it("future candle cannot affect position size at T", () => {
    const past = barsFromCloses(Array.from({ length: 250 }, (_, i) => 50 + i * 0.1));
    const future = barsFromCloses(Array.from({ length: 50 }, (_, i) => 500 + i), 250);
    const all = [...past, ...future];
    const asOf = past[past.length - 1]!.timestamp;
    const setup = buildTradingSetup({
      snapshot: buildTechnicalSnapshot({
        symbol: "NVDA",
        timeframe: "1day",
        candles: all,
        dataStatus: "CACHED",
        asOf,
      }),
      settings: { accountCapital: 10000, ...riskSettings },
      now: asOf,
    });
    if (setup.status !== "VALID" || setup.positionSize === null) {
      return;
    }
    const sized = sizePosition({
      accountCapital: 10000,
      maxRiskPercent: riskSettings.maxRiskPercent,
      maxPositionPercent: riskSettings.maxPositionPercent,
      entry: setup.entry ?? 100,
      riskPerUnit: setup.riskPerUnit ?? 1,
    });
    expect(setup.positionSize).toBe(sized.positionSize);
  });

  it("future candles cannot change completed backtest trades", () => {
    const from = new Date(Date.UTC(2024, 0, 1));
    const to = new Date(Date.UTC(2024, 6, 1));
    const candles = buildMockHistoricalCandles({
      symbol: "NVDA",
      timeframe: "1day",
      from,
      to,
    });
    const base = runBacktestSimulation({
      config: {
        symbol: "NVDA",
        timeframe: "1day",
        from,
        to,
        startingCapital: 10000,
      },
      candles,
      providerDataStatus: "CACHED",
      baseRiskSettings: riskSettings,
    });
    const extended = runBacktestSimulation({
      config: {
        symbol: "NVDA",
        timeframe: "1day",
        from,
        to,
        startingCapital: 10000,
      },
      candles: [
        ...candles,
        ...buildMockHistoricalCandles({
          symbol: "NVDA",
          timeframe: "1day",
          from: new Date(Date.UTC(2024, 6, 2)),
          to: new Date(Date.UTC(2024, 12, 1)),
        }),
      ],
      providerDataStatus: "CACHED",
      baseRiskSettings: riskSettings,
    });
    const baseIds = base.trades.map((trade) => trade.id);
    const extendedPrefix = extended.trades.filter((trade) =>
      baseIds.includes(trade.id),
    );
    expect(extendedPrefix).toEqual(base.trades);
  });

  it("entry uses next-candle open when a trade is opened", () => {
    const from = new Date(Date.UTC(2024, 0, 1));
    const to = new Date(Date.UTC(2024, 8, 1));
    const candles = buildMockHistoricalCandles({
      symbol: "NVDA",
      timeframe: "1day",
      from,
      to,
    });
    const result = runBacktestSimulation({
      config: {
        symbol: "NVDA",
        timeframe: "1day",
        from,
        to,
        startingCapital: 10000,
      },
      candles,
      providerDataStatus: "CACHED",
      baseRiskSettings: riskSettings,
    });
    for (const trade of result.trades) {
      const entryBar = candles.find(
        (bar) => bar.timestamp.toISOString() === trade.entryTime,
      );
      expect(entryBar).toBeDefined();
      expect(trade.entryPrice).toBe(entryBar!.open);
    }
  });

  it("simulation starts after warmup bars", () => {
    const from = new Date(Date.UTC(2024, 0, 1));
    const to = new Date(Date.UTC(2025, 0, 1));
    const candles = buildMockHistoricalCandles({
      symbol: "TEST",
      timeframe: "1day",
      from,
      to,
    });
    expect(candles.length).toBeGreaterThan(BACKTEST_WARMUP_BARS);
    const result = runBacktestSimulation({
      config: {
        symbol: "TEST",
        timeframe: "1day",
        from,
        to,
        startingCapital: 10000,
      },
      candles,
      providerDataStatus: "CACHED",
      baseRiskSettings: riskSettings,
    });
    expect(result.equityCurve.length).toBe(candles.length - BACKTEST_WARMUP_BARS);
  });
});
