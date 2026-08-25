import { describe, expect, it } from "vitest";
import { prepareCandles } from "@/engine/utils/validation";
import { validateHistoricalCandles } from "./candles";

function bar(
  day: number,
  close: number,
  overrides: Partial<{ open: number; high: number; low: number }> = {},
) {
  return {
    timestamp: new Date(Date.UTC(2026, 0, day)),
    open: overrides.open ?? close - 0.5,
    high: overrides.high ?? close + 1,
    low: overrides.low ?? close - 1,
    close,
    volume: 1000,
  };
}

describe("historical candle validation", () => {
  it("accepts valid chronological candles", () => {
    const result = validateHistoricalCandles([
      bar(1, 10),
      bar(2, 11),
      bar(3, 12),
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.candles).toHaveLength(3);
    }
  });

  it("rejects invalid OHLC relationships", () => {
    const result = validateHistoricalCandles([
      {
        timestamp: new Date(Date.UTC(2026, 0, 1)),
        open: 10,
        high: 9,
        low: 8,
        close: 10,
        volume: 1,
      },
    ]);
    expect(result.ok).toBe(false);
  });

  it("duplicate timestamps use last input bar wins via prepareCandles", () => {
    const ts = new Date(Date.UTC(2026, 0, 1));
    const prepared = prepareCandles([
      {
        timestamp: ts,
        open: 10,
        high: 11,
        low: 9,
        close: 10,
        volume: 1,
      },
      {
        timestamp: ts,
        open: 20,
        high: 22,
        low: 18,
        close: 21,
        volume: 2,
      },
    ]);
    expect(prepared).toHaveLength(1);
    expect(prepared[0]?.close).toBe(21);
  });

  it("rejects empty input", () => {
    expect(validateHistoricalCandles([]).ok).toBe(false);
  });
});
