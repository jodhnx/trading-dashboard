import type { PaperCloseReason } from "@/types/database";
import type { PositionSide } from "@/types/enums";
import {
  ANALYTICS_DATASETS,
  ANALYTICS_PRESETS,
} from "./constants";

export type AnalyticsPreset = (typeof ANALYTICS_PRESETS)[number];
export type AnalyticsDataset = (typeof ANALYTICS_DATASETS)[number];

export type AnalyticsFilters = {
  preset?: AnalyticsPreset;
  from?: string;
  to?: string;
  symbol?: string;
  dataset?: AnalyticsDataset;
};

export type ResolvedDateRange = {
  preset: AnalyticsPreset | "CUSTOM";
  from: string | null;
  to: string | null;
};

export type PaperPerformanceSummary = {
  startingBalance: number;
  cash: number;
  equity: number | null;
  realizedPnL: number | null;
  unrealizedPnL: number | null;
  totalReturn: number | null;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number | null;
  averageWinningTrade: number | null;
  averageLosingTrade: number | null;
  averageTrade: number | null;
  largestWinner: number | null;
  largestLoser: number | null;
  grossProfit: number | null;
  grossLoss: number | null;
  profitFactor: number | null;
  maxDrawdown: number | null;
  averageRiskReward: number | null;
};

export type PaperEquityPoint = {
  timestamp: string;
  equity: number;
  drawdown: number;
};

export type AssetPerformanceRow = {
  symbol: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  totalPnL: number | null;
  averagePnL: number | null;
  largestWin: number | null;
  largestLoss: number | null;
  averageRiskReward: number | null;
};

export type SidePerformanceRow = {
  side: PositionSide;
  trades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  totalPnL: number | null;
  averagePnL: number | null;
};

export type ScoreBucketRow = {
  bucket: string;
  trades: number;
  winRate: number | null;
  totalPnL: number | null;
  averagePnL: number | null;
  insufficientData: boolean;
};

export type ExitReasonRow = {
  reason: PaperCloseReason;
  count: number;
  totalPnL: number | null;
  averagePnL: number | null;
};

export type JournalRatingGroup = {
  setupRating: number;
  trades: number;
  totalRealizedPnL: number | null;
};

export type JournalAnalyticsSection = {
  hasData: boolean;
  totalEntries: number;
  reviewedTrades: number;
  averageSetupRating: number | null;
  averageExecutionRating: number | null;
  averageDisciplineRating: number | null;
  mostCommonMistake: string | null;
  mostCommonEmotionalState: string | null;
  topTags: Array<{ tag: string; count: number }>;
  ratingGroups: JournalRatingGroup[];
};

export type BacktestRunSummary = {
  id: string;
  symbol: string | null;
  timeframe: string | null;
  from: string | null;
  to: string | null;
  totalReturn: number | null;
  totalTrades: number | null;
  winRate: number | null;
  maxDrawdown: number | null;
  profitFactor: number | null;
  status: string;
  createdAt: string;
};

export type BacktestAnalyticsSection = {
  hasSavedResults: boolean;
  runs: BacktestRunSummary[];
};

export type PaperAnalyticsSection = {
  hasData: boolean;
  summary: PaperPerformanceSummary;
  equityCurve: PaperEquityPoint[];
  byAsset: AssetPerformanceRow[];
  bySide: SidePerformanceRow[];
  byScore: ScoreBucketRow[];
  byExitReason: ExitReasonRow[];
};

export type AnalyticsViewModel = {
  filters: ResolvedDateRange & {
    symbol: string;
    dataset: AnalyticsDataset;
  };
  paper: PaperAnalyticsSection;
  journal: JournalAnalyticsSection;
  backtest: BacktestAnalyticsSection;
};

export type AnalyticsErrorCode = "UNAUTHORIZED" | "INVALID_FILTER" | "DATA_UNAVAILABLE";
