import { describe, expect, it } from "vitest";
import { validateBusinessRules } from "./validate";
import {
  analysisInput,
  analysisOutput,
  liveSnapshot,
  longSetup,
  shortSetup,
  TEST_SETTINGS,
} from "./test-fixtures";
import { buildTradingSetup } from "@/engine/trading/setup";

describe("validateBusinessRules", () => {
  it("accepts a valid BUY_SETUP", () => {
    const setup = longSetup();
    expect(setup.status).toBe("VALID");
    expect(setup.direction).toBe("LONG");
    const result = validateBusinessRules(
      analysisOutput(setup),
      analysisInput({ setup }),
    );
    expect(result).toEqual({ ok: true });
  });

  it("accepts a valid SHORT_SETUP", () => {
    const setup = shortSetup();
    expect(setup.status).toBe("VALID");
    expect(setup.direction).toBe("SHORT");
    const result = validateBusinessRules(
      analysisOutput(setup, { decision: "SHORT_SETUP" }),
      analysisInput({
        setup,
        snapshot: liveSnapshot({
          currentPrice: 100,
          ema20: 102,
          ema50: 105,
          ema200: 110,
          rsi14: 35,
          macd: -1,
          macdSignal: -0.3,
          macdHistogram: -0.4,
          trend: "BEARISH",
          momentum: "NEGATIVE",
        }),
      }),
    );
    expect(result).toEqual({ ok: true });
  });

  it("accepts WATCHLIST for a valid setup", () => {
    const setup = longSetup();
    const result = validateBusinessRules(
      analysisOutput(setup, { decision: "WATCHLIST" }),
      analysisInput({ setup }),
    );
    expect(result).toEqual({ ok: true });
  });

  it("accepts NO_TRADE", () => {
    const setup = longSetup();
    const result = validateBusinessRules(
      analysisOutput(setup, { decision: "NO_TRADE" }),
      analysisInput({ setup }),
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects BUY_SETUP when the engine setup is not VALID", () => {
    const setup = buildTradingSetup({
      snapshot: liveSnapshot({ trend: "NEUTRAL", momentum: "NEGATIVE" }),
      settings: TEST_SETTINGS,
      now: new Date("2026-08-24T18:00:00.000Z"),
    });
    expect(setup.status).not.toBe("VALID");
    const result = validateBusinessRules(
      analysisOutput(setup, { decision: "BUY_SETUP" }),
      analysisInput({ setup, snapshot: liveSnapshot({ trend: "NEUTRAL" }) }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_SETUP");
    }
  });

  it("rejects SHORT_SETUP when the engine setup is not VALID", () => {
    const setup = buildTradingSetup({
      snapshot: liveSnapshot({ trend: "NEUTRAL" }),
      settings: TEST_SETTINGS,
      now: new Date("2026-08-24T18:00:00.000Z"),
    });
    const result = validateBusinessRules(
      analysisOutput(setup, { decision: "SHORT_SETUP" }),
      analysisInput({ setup, snapshot: liveSnapshot({ trend: "NEUTRAL" }) }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_SETUP");
    }
  });

  it("rejects BUY_SETUP on STALE data", () => {
    const setup = longSetup();
    const result = validateBusinessRules(
      analysisOutput(setup),
      analysisInput({ setup, dataStatus: "STALE" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("STALE_DATA");
    }
  });

  it("rejects BUY_SETUP on UNAVAILABLE data", () => {
    const setup = longSetup();
    const result = validateBusinessRules(
      analysisOutput(setup),
      analysisInput({ setup, dataStatus: "UNAVAILABLE" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("DATA_UNAVAILABLE");
    }
  });

  it("rejects BUY_SETUP on MOCK data", () => {
    const setup = longSetup();
    const result = validateBusinessRules(
      analysisOutput(setup),
      analysisInput({ setup, dataStatus: "MOCK" }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a modified Entry", () => {
    const setup = longSetup();
    const result = validateBusinessRules(
      analysisOutput(setup, {
        setupReference: {
          entry: (setup.entry ?? 0) + 3,
          stopLoss: setup.stopLoss,
          takeProfit: setup.takeProfit,
          riskReward: setup.riskReward,
          positionSize: setup.positionSize,
        },
      }),
      analysisInput({ setup }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/setupReference/);
    }
  });

  it("rejects a modified Stop", () => {
    const setup = longSetup();
    const result = validateBusinessRules(
      analysisOutput(setup, {
        setupReference: {
          entry: setup.entry,
          stopLoss: (setup.stopLoss ?? 0) + 1,
          takeProfit: setup.takeProfit,
          riskReward: setup.riskReward,
          positionSize: setup.positionSize,
        },
      }),
      analysisInput({ setup }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a modified Target", () => {
    const setup = longSetup();
    const result = validateBusinessRules(
      analysisOutput(setup, {
        setupReference: {
          entry: setup.entry,
          stopLoss: setup.stopLoss,
          takeProfit: (setup.takeProfit ?? 0) + 5,
          riskReward: setup.riskReward,
          positionSize: setup.positionSize,
        },
      }),
      analysisInput({ setup }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a modified Position Size", () => {
    const setup = longSetup();
    const result = validateBusinessRules(
      analysisOutput(setup, {
        setupReference: {
          entry: setup.entry,
          stopLoss: setup.stopLoss,
          takeProfit: setup.takeProfit,
          riskReward: setup.riskReward,
          positionSize: (setup.positionSize ?? 0) + 10,
        },
      }),
      analysisInput({ setup }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects unknown usedNewsIds", () => {
    const setup = longSetup();
    const result = validateBusinessRules(
      analysisOutput(setup, { usedNewsIds: ["ghost-id"] }),
      analysisInput({ setup }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a headline that was not in the input", () => {
    const setup = longSetup();
    const result = validateBusinessRules(
      analysisOutput(setup, {
        supportingSignals: ["Headline: Totally fake breaking news about NVDA"],
      }),
      analysisInput({ setup }),
    );
    expect(result.ok).toBe(false);
  });
});
