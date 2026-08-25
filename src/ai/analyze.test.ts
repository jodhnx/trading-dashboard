import { describe, expect, it } from "vitest";
import { analyzeTradingSetup } from "./analyze";
import { MockOpenAiClient } from "./client";
import {
  analysisInput,
  analysisOutput,
  liveSnapshot,
  longSetup,
  shortSetup,
  TEST_SETTINGS,
} from "./test-fixtures";
import { buildTradingSetup } from "@/engine/trading/setup";

describe("analyzeTradingSetup", () => {
  const now = new Date("2026-08-24T18:00:00.000Z");

  it("returns a BUY_SETUP record from a mock client", async () => {
    const setup = longSetup();
    const client = new MockOpenAiClient(analysisOutput(setup));
    expect(client.isMock).toBe(true);
    const result = await analyzeTradingSetup({
      payload: analysisInput({ setup }),
      setup,
      client,
      now,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.analysis.decision).toBe("BUY_SETUP");
      expect(result.analysis.setupReference.entry).toBe(setup.entry);
      expect(result.analysis.isMock).toBe(true);
      expect(result.analysis.model).toBe("mock-analysis");
    }
  });

  it("returns a SHORT_SETUP record", async () => {
    const setup = shortSetup();
    const snapshot = liveSnapshot({
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
    });
    const result = await analyzeTradingSetup({
      payload: analysisInput({ setup, snapshot }),
      setup,
      client: new MockOpenAiClient(analysisOutput(setup, { decision: "SHORT_SETUP" })),
      now,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.analysis.decision).toBe("SHORT_SETUP");
    }
  });

  it("returns WATCHLIST", async () => {
    const setup = longSetup();
    const result = await analyzeTradingSetup({
      payload: analysisInput({ setup }),
      setup,
      client: new MockOpenAiClient(analysisOutput(setup, { decision: "WATCHLIST" })),
      now,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.analysis.decision).toBe("WATCHLIST");
    }
  });

  it("returns NO_TRADE", async () => {
    const setup = longSetup();
    const result = await analyzeTradingSetup({
      payload: analysisInput({ setup }),
      setup,
      client: new MockOpenAiClient(analysisOutput(setup, { decision: "NO_TRADE" })),
      now,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.analysis.decision).toBe("NO_TRADE");
    }
  });

  it("rejects hallucinated engine numbers from the mock", async () => {
    const setup = longSetup();
    const result = await analyzeTradingSetup({
      payload: analysisInput({ setup }),
      setup,
      client: new MockOpenAiClient(
        analysisOutput(setup, {
          setupReference: {
            entry: 999,
            stopLoss: 1,
            takeProfit: 5000,
            riskReward: 99,
            positionSize: 10_000,
          },
        }),
      ),
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AI_ANALYSIS_INVALID");
    }
  });

  it("does not allow BUY_SETUP when the engine says NO_TRADE", async () => {
    const snapshot = liveSnapshot({ trend: "NEUTRAL", momentum: "NEGATIVE" });
    const setup = buildTradingSetup({
      snapshot,
      settings: TEST_SETTINGS,
      now,
    });
    expect(setup.direction).toBe("NO_TRADE");
    const result = await analyzeTradingSetup({
      payload: analysisInput({ setup, snapshot }),
      setup,
      client: new MockOpenAiClient(analysisOutput(setup, { decision: "BUY_SETUP" })),
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_SETUP");
    }
  });

  it("maps invalid JSON from the client to AI_ANALYSIS_INVALID", async () => {
    const setup = longSetup();
    const result = await analyzeTradingSetup({
      payload: analysisInput({ setup }),
      setup,
      client: {
        isMock: true,
        model: "mock-analysis",
        completeStructured: async () => ({ status: "AI_ANALYSIS_INVALID" }),
      },
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AI_ANALYSIS_INVALID");
    }
  });

  it("maps timeout from the client to AI_TIMEOUT", async () => {
    const setup = longSetup();
    const result = await analyzeTradingSetup({
      payload: analysisInput({ setup }),
      setup,
      client: {
        isMock: true,
        model: "mock-analysis",
        completeStructured: async () => ({ status: "AI_TIMEOUT" }),
      },
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AI_TIMEOUT");
    }
  });

  it("passes through OpenAI quota errors as AI_UNAVAILABLE", async () => {
    const setup = longSetup();
    const result = await analyzeTradingSetup({
      payload: analysisInput({ setup }),
      setup,
      client: {
        isMock: true,
        model: "mock-analysis",
        completeStructured: async () => ({
          status: "AI_UNAVAILABLE",
          detail: "OpenAI quota exceeded",
        }),
      },
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AI_UNAVAILABLE");
      expect(result.error).toBe("OpenAI quota exceeded");
    }
  });
});
