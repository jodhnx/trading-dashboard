import type { DailyBriefRow, Json } from "@/types/database";
import { BRIEF_STATUSES, type BriefStatus } from "@/types/enums";
import { isBriefStale } from "./date";
import type {
  BriefAiItem,
  BriefAiStatus,
  BriefDataStatus,
  BriefMacroItem,
  BriefMarketItem,
  BriefNewsItem,
  BriefNoTradeItem,
  BriefOpportunityItem,
  BriefSetupItem,
  BriefTechnicalItem,
  BriefWatchItem,
  DailyBriefInputSnapshot,
  DailyBriefRecord,
} from "./types";
import { DAILY_BRIEF_PROMPT_VERSION } from "./types";

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asBriefStatus(value: string): BriefStatus {
  return (BRIEF_STATUSES as readonly string[]).includes(value)
    ? (value as BriefStatus)
    : "NO_TRADE";
}

function asDataStatus(value: unknown): BriefDataStatus {
  const allowed = ["LIVE", "CACHED", "STALE", "MIXED", "UNAVAILABLE", "MOCK"];
  return typeof value === "string" && allowed.includes(value)
    ? (value as BriefDataStatus)
    : "UNAVAILABLE";
}

function asAiStatus(value: unknown): BriefAiStatus {
  const allowed = [
    "ok",
    "AI_UNAVAILABLE",
    "AI_TIMEOUT",
    "AI_ANALYSIS_INVALID",
    "SKIPPED",
  ];
  return typeof value === "string" && allowed.includes(value)
    ? (value as BriefAiStatus)
    : "SKIPPED";
}

export type BriefInsert = {
  userId: string;
  briefDate: string;
  marketRegime: string;
  riskEnvironment: string;
  summary: string;
  finalStatus: BriefStatus;
  snapshot: DailyBriefInputSnapshot;
  model: string | null;
  promptVersion: string;
  aiStatus: BriefAiStatus;
  isMock: boolean;
  generatedAt: string;
};

export function toBriefInsertRow(input: BriefInsert): {
  user_id: string;
  brief_date: string;
  market_regime: string;
  risk_environment: string;
  summary: string;
  important_news: Json;
  macro_events: Json;
  final_status: BriefStatus;
  generated_at: string;
  market_overview: Json;
  technical_conditions: Json;
  trading_setups: Json;
  ai_analyses: Json;
  top_opportunities: Json;
  watchlist: Json;
  no_trade_assets: Json;
  risks: string[];
  input_snapshot: Json;
  model: string | null;
  prompt_version: string;
  data_status: BriefDataStatus;
  timezone: string;
  is_mock: boolean;
  ai_status: BriefAiStatus;
} {
  const snap = input.snapshot;
  return {
    user_id: input.userId,
    brief_date: input.briefDate,
    market_regime: input.marketRegime,
    risk_environment: input.riskEnvironment,
    summary: input.summary,
    important_news: snap.importantNews as unknown as Json,
    macro_events: snap.macroEvents as unknown as Json,
    final_status: input.finalStatus,
    generated_at: input.generatedAt,
    market_overview: snap.marketOverview as unknown as Json,
    technical_conditions: snap.technicalConditions as unknown as Json,
    trading_setups: snap.tradingSetups as unknown as Json,
    ai_analyses: snap.aiAnalyses as unknown as Json,
    top_opportunities: snap.topOpportunities as unknown as Json,
    watchlist: snap.watchlist as unknown as Json,
    no_trade_assets: snap.noTradeAssets as unknown as Json,
    risks: snap.risks,
    input_snapshot: snap as unknown as Json,
    model: input.model,
    prompt_version: input.promptVersion,
    data_status: snap.dataStatus,
    timezone: snap.timezone,
    is_mock: input.isMock,
    ai_status: input.aiStatus,
  };
}

export function briefFromRow(
  row: DailyBriefRow,
  now: Date = new Date(),
): DailyBriefRecord {
  return {
    id: row.id,
    userId: row.user_id,
    briefDate: row.brief_date,
    timezone: row.timezone ?? "UTC",
    marketRegime: row.market_regime,
    riskEnvironment: row.risk_environment,
    summary: row.summary ?? "",
    finalStatus: asBriefStatus(row.final_status),
    marketOverview: asArray<BriefMarketItem>(row.market_overview),
    technicalConditions: asArray<BriefTechnicalItem>(row.technical_conditions),
    tradingSetups: asArray<BriefSetupItem>(row.trading_setups),
    importantNews: asArray<BriefNewsItem>(row.important_news),
    macroEvents: asArray<BriefMacroItem>(row.macro_events),
    aiAnalyses: asArray<BriefAiItem>(row.ai_analyses),
    topOpportunities: asArray<BriefOpportunityItem>(row.top_opportunities),
    watchlist: asArray<BriefWatchItem>(row.watchlist),
    noTradeAssets: asArray<BriefNoTradeItem>(row.no_trade_assets),
    risks: row.risks ?? [],
    dataStatus: asDataStatus(row.data_status),
    aiStatus: asAiStatus(row.ai_status),
    model: row.model,
    promptVersion: row.prompt_version ?? DAILY_BRIEF_PROMPT_VERSION,
    isMock: row.is_mock ?? false,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
    isStale: isBriefStale({
      briefDate: row.brief_date,
      generatedAt: row.generated_at,
      now,
    }),
  };
}
