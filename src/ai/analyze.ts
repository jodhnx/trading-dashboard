import type { OpenAiClient, AnalyzeResult, TradingAnalysisInput } from "./types";
import { TRADING_ANALYSIS_JSON_SCHEMA, tradingAnalysisOutputSchema } from "./schemas";
import {
  TRADING_ANALYSIS_PROMPT_VERSION,
  TRADING_ANALYSIS_SYSTEM_PROMPT,
  tradingAnalysisUserPrompt,
} from "./prompts";
import { validateBusinessRules } from "./validate";
import { engineSetupReference } from "./payload";
import type { TradingSetup } from "@/engine/trading/types";

export async function analyzeTradingSetup(input: {
  payload: TradingAnalysisInput;
  setup: TradingSetup;
  client: OpenAiClient;
  now?: Date;
}): Promise<AnalyzeResult> {
  const completion = await input.client.completeStructured({
    system: TRADING_ANALYSIS_SYSTEM_PROMPT,
    user: tradingAnalysisUserPrompt(input.payload),
    schemaName: "trading_analysis",
    schema: TRADING_ANALYSIS_JSON_SCHEMA as unknown as Record<string, unknown>,
  });

  if (completion.status !== "ok") {
    return {
      ok: false,
      code: completion.status,
      error:
        completion.detail ??
        (completion.status === "AI_TIMEOUT"
          ? "AI request timed out"
          : completion.status === "AI_ANALYSIS_INVALID"
            ? "AI returned invalid JSON"
            : "AI is unavailable"),
    };
  }

  const parsed = tradingAnalysisOutputSchema.safeParse(completion.value);
  if (!parsed.success) {
    return {
      ok: false,
      code: "AI_ANALYSIS_INVALID",
      error: parsed.error.issues[0]?.message ?? "AI output failed schema validation",
    };
  }

  const business = validateBusinessRules(parsed.data, input.payload);
  if (!business.ok) {
    return {
      ok: false,
      code: business.code,
      error: business.reason,
    };
  }

  const now = input.now ?? new Date();
  return {
    ok: true,
    analysis: {
      id: null,
      symbol: input.payload.asset,
      timeframe: input.payload.timeframe,
      decision: parsed.data.decision,
      confidence: parsed.data.confidence,
      summary: parsed.data.summary,
      thesis: parsed.data.thesis,
      risks: parsed.data.risks,
      uncertainties: parsed.data.uncertainties,
      supportingSignals: parsed.data.supportingSignals,
      contradictingSignals: parsed.data.contradictingSignals,
      newsImpact: parsed.data.newsImpact,
      timeHorizon: parsed.data.timeHorizon,
      setupReference: engineSetupReference(input.setup),
      model: input.client.model,
      isMock: input.client.isMock,
      analyzedAt: now.toISOString(),
      dataTimestamp: input.payload.marketData.asOf,
      dataStatus: input.payload.marketData.dataStatus,
      newsCount: input.payload.relevantNews.length,
      news: input.payload.relevantNews,
      promptVersion: TRADING_ANALYSIS_PROMPT_VERSION,
    },
  };
}
