import "server-only";

import { createMarketDataService } from "@/services/market/create-service";
import { createNewsService } from "@/services/news/create-service";
import { getOrCreateAccountSettings } from "@/lib/settings/service";
import { toTradingRiskSettings } from "@/lib/settings/schema";
import { buildTradingSetup } from "@/engine/trading/setup";
import { analyzeTradingSetup } from "@/ai/analyze";
import { buildTradingAnalysisInput } from "@/ai/payload";
import { createOpenAiClient } from "@/ai/create-client";
import type { OpenAiClient } from "@/ai/types";
import { ENGINE_ERROR_CODES } from "@/engine/utils/validation";
import {
  findAnalysisByFingerprint,
  findAssetIdBySymbol,
  persistAnalysis,
} from "@/services/ai/persistence";
import { MARKET_WATCHLIST } from "@/services/market/symbols";
import { DAILY_BRIEF_TIMEFRAME } from "@/services/daily-brief/types";
import { computeAnalysisFingerprint } from "./fingerprint";
import { isPipelineAnalysisEligible } from "./eligibility";

export type PipelineAiResult = {
  requested: number;
  completed: number;
  reused: number;
  skipped: number;
  unavailable: number;
};

export async function runPipelineAiForUser(input: {
  userId: string;
  email: string | null;
  client?: OpenAiClient | null;
  now?: Date;
}): Promise<PipelineAiResult> {
  const now = input.now ?? new Date();
  const counts: PipelineAiResult = {
    requested: 0,
    completed: 0,
    reused: 0,
    skipped: 0,
    unavailable: 0,
  };

  const client =
    input.client === undefined ? createOpenAiClient() : input.client;
  if (!client || (client.isMock && process.env.NODE_ENV === "production")) {
    counts.skipped = MARKET_WATCHLIST.length;
    return counts;
  }

  let settings;
  try {
    settings = await getOrCreateAccountSettings(input.userId, input.email, {
      persistence: "admin",
    });
  } catch {
    counts.skipped = MARKET_WATCHLIST.length;
    return counts;
  }

  const risk = toTradingRiskSettings(settings);
  const market = createMarketDataService();
  const newsService = createNewsService();

  for (const asset of MARKET_WATCHLIST) {
    const symbol = asset.symbol;
    try {
      const technical = await market.getTechnicalSnapshot(
        symbol,
        DAILY_BRIEF_TIMEFRAME,
      );
      if (
        technical.snapshot.dataStatus === "UNAVAILABLE" ||
        technical.snapshot.dataError === ENGINE_ERROR_CODES.DATA_UNAVAILABLE
      ) {
        counts.skipped += 1;
        continue;
      }

      const setup = buildTradingSetup({
        snapshot: technical.snapshot,
        settings: risk,
        now,
      });

      const eligibility = isPipelineAnalysisEligible({
        dataStatus: technical.snapshot.dataStatus,
        setupDirection: setup.direction,
      });
      if (!eligibility.eligible) {
        counts.skipped += 1;
        continue;
      }

      let newsItems: Awaited<
        ReturnType<ReturnType<typeof createNewsService>["listNews"]>
      >["items"] = [];
      try {
        const news = await newsService.listNews({
          asset: symbol,
          limit: 10,
        });
        newsItems = news.items;
      } catch {
        newsItems = [];
      }

      const payload = buildTradingAnalysisInput({
        symbol,
        timeframe: DAILY_BRIEF_TIMEFRAME,
        snapshot: technical.snapshot,
        setup,
        news: newsItems,
        settings: risk,
        now,
      });
      const fingerprint = computeAnalysisFingerprint(payload);

      const existing = await findAnalysisByFingerprint({
        userId: input.userId,
        symbol,
        fingerprint,
        persistence: "admin",
      });
      if (existing) {
        counts.reused += 1;
        continue;
      }

      counts.requested += 1;
      const analyzed = await analyzeTradingSetup({
        payload,
        setup,
        client,
        now,
      });
      if (!analyzed.ok) {
        if (
          analyzed.code === "AI_UNAVAILABLE" ||
          analyzed.code === "AI_TIMEOUT" ||
          analyzed.code === "AI_ANALYSIS_INVALID"
        ) {
          counts.unavailable += 1;
        } else {
          counts.skipped += 1;
        }
        continue;
      }

      const assetId = await findAssetIdBySymbol(symbol, "admin");
      if (!assetId) {
        counts.unavailable += 1;
        continue;
      }

      const stored = await persistAnalysis({
        userId: input.userId,
        assetId,
        record: analyzed.analysis,
        payload,
        setupScore: setup.score,
        inputFingerprint: fingerprint,
        persistence: "admin",
      });
      if (stored) {
        counts.completed += 1;
      } else {
        counts.unavailable += 1;
      }
    } catch {
      counts.unavailable += 1;
    }
  }

  return counts;
}
