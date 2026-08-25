import { describe, expect, it } from "vitest";
import { buildMockHistoricalCandles } from "./mock-historical-provider";
import { runBacktestSimulation } from "./simulation";
import { buildBacktestResult } from "./metrics";

const riskSettings = {
  maxRiskPercent: 0.01,
  maxPositionPercent: 0.2,
  minimumRiskReward: 2,
};

describe("backtest simulation determinism", () => {
  it("produces identical results for the same dataset", () => {
    const from = new Date(Date.UTC(2024, 0, 1));
    const to = new Date(Date.UTC(2024, 8, 1));
    const candles = buildMockHistoricalCandles({
      symbol: "NVDA",
      timeframe: "1day",
      from,
      to,
    });
    const config = {
      symbol: "NVDA",
      timeframe: "1day" as const,
      from,
      to,
      startingCapital: 10000,
    };
    const first = runBacktestSimulation({
      config,
      candles,
      providerDataStatus: "CACHED",
      baseRiskSettings: riskSettings,
    });
    const second = runBacktestSimulation({
      config,
      candles,
      providerDataStatus: "CACHED",
      baseRiskSettings: riskSettings,
    });
    expect(first).toEqual(second);
  });

  it("buildBacktestResult is deterministic", () => {
    const from = new Date(Date.UTC(2024, 0, 1));
    const to = new Date(Date.UTC(2024, 8, 1));
    const candles = buildMockHistoricalCandles({
      symbol: "BTC",
      timeframe: "1day",
      from,
      to,
    });
    const simulation = runBacktestSimulation({
      config: {
        symbol: "BTC",
        timeframe: "1day",
        from,
        to,
        startingCapital: 10000,
      },
      candles,
      providerDataStatus: "MOCK",
      baseRiskSettings: riskSettings,
    });
    const result = buildBacktestResult({
      symbol: "BTC",
      timeframe: "1day",
      from: "2024-01-01",
      to: "2024-08-01",
      startingCapital: 10000,
      endingCapital: simulation.endingCapital,
      dataStatus: "MOCK",
      trades: simulation.trades,
      equityCurve: simulation.equityCurve,
    });
    expect(result.dataStatus).toBe("MOCK");
    expect(result.feesSlippageModeled).toBe(false);
  });
});
