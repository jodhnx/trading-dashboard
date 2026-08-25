import "server-only";

import { createMarketDataService } from "@/services/market/create-service";
import { createNewsService } from "@/services/news/create-service";
import { getOrCreateAccountSettings } from "@/lib/settings/service";
import { toTradingRiskSettings } from "@/lib/settings/schema";
import { buildTradingSetup } from "@/engine/trading/setup";
import { analyzeTradingSetup } from "@/ai/analyze";
import { buildTradingAnalysisInput } from "@/ai/payload";
import { createOpenAiClient } from "@/ai/create-client";
import type { AnalyzeResult, OpenAiClient } from "@/ai/types";
import { ENGINE_ERROR_CODES } from "@/engine/utils/validation";
import { findAssetIdBySymbol, persistAnalysis } from "./persistence";
import {
  analysisRequestKey,
  beginAnalysisRequest,
  endAnalysisRequest,
} from "./request-guard";
import type { Timeframe } from "@/types/enums";

export async function runTradingAnalysis(input: {
  userId: string;
  email: string | null;
  symbol: string;
  timeframe: Timeframe;
  client?: OpenAiClient | null;
  now?: Date;
}): Promise<AnalyzeResult> {
  const key = analysisRequestKey(input.userId, input.symbol, input.timeframe);
  if (!beginAnalysisRequest(key)) {
    return {
      ok: false,
      code: "REQUEST_IN_PROGRESS",
      error: "An analysis for this symbol is already running",
    };
  }

  try {
    if (input.client?.isMock && process.env.NODE_ENV === "production") {
      return {
        ok: false,
        code: "AI_UNAVAILABLE",
        error: "Mock AI is not allowed in production",
      };
    }

    const client = input.client === undefined ? createOpenAiClient() : input.client;
    if (!client) {
      return { ok: false, code: "AI_UNAVAILABLE", error: "OpenAI is not configured" };
    }

    let settings;
    try {
      settings = await getOrCreateAccountSettings(input.userId, input.email);
    } catch {
      return {
        ok: false,
        code: "DATA_UNAVAILABLE",
        error: "SETTINGS UNAVAILABLE",
      };
    }

    const risk = toTradingRiskSettings(settings);
    const technical = await createMarketDataService().getTechnicalSnapshot(
      input.symbol,
      input.timeframe,
    );

    if (
      technical.snapshot.dataStatus === "UNAVAILABLE" ||
      technical.snapshot.dataError === ENGINE_ERROR_CODES.DATA_UNAVAILABLE
    ) {
      return {
        ok: false,
        code: "DATA_UNAVAILABLE",
        error: "MARKET DATA UNAVAILABLE",
      };
    }

    const setup = buildTradingSetup({
      snapshot: technical.snapshot,
      settings: risk,
      now: input.now,
    });

    let newsItems: Awaited<
      ReturnType<ReturnType<typeof createNewsService>["listNews"]>
    >["items"] = [];
    try {
      const news = await createNewsService().listNews({
        asset: input.symbol,
        limit: 10,
      });
      newsItems = news.items;
    } catch {
      newsItems = [];
    }

    const payload = buildTradingAnalysisInput({
      symbol: input.symbol,
      timeframe: input.timeframe,
      snapshot: technical.snapshot,
      setup,
      news: newsItems,
      settings: risk,
      now: input.now,
    });

    const analyzed = await analyzeTradingSetup({
      payload,
      setup,
      client,
      now: input.now,
    });
    if (!analyzed.ok) {
      return analyzed;
    }

    const assetId = await findAssetIdBySymbol(input.symbol);
    if (assetId) {
      const stored = await persistAnalysis({
        userId: input.userId,
        assetId,
        record: analyzed.analysis,
        payload,
        setupScore: setup.score,
      });
      if (stored) {
        return { ok: true, analysis: stored };
      }
    }

    return analyzed;
  } finally {
    endAnalysisRequest(key);
  }
}
