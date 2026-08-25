import type { PositionSide } from "@/types/enums";
import type { PaperSetupSnapshot } from "@/services/paper/types";

export const JOURNAL_ERROR_CODES = [
  "UNAUTHORIZED",
  "INVALID_INPUT",
  "NOT_FOUND",
  "CONFLICT",
  "DATA_UNAVAILABLE",
] as const;
export type JournalErrorCode = (typeof JOURNAL_ERROR_CODES)[number];

export type JournalEntryRecord = {
  id: string;
  userId: string;
  paperTradeId: string | null;
  assetId: string | null;
  symbol: string | null;
  side: PositionSide | null;
  entryPrice: number | null;
  exitPrice: number | null;
  quantity: number | null;
  realizedPnL: number | null;
  realizedPnLPercent: number | null;
  entryTime: string | null;
  exitTime: string | null;
  setupRating: number | null;
  executionRating: number | null;
  disciplineRating: number | null;
  emotionalState: string | null;
  mistakeType: string | null;
  lesson: string | null;
  whatWentWell: string | null;
  whatWentWrong: string | null;
  notes: string | null;
  tags: string[];
  setupSnapshot: PaperSetupSnapshot | null;
  setupScore: number | null;
  createdAt: string;
  updatedAt: string;
};

export type JournalListFilters = {
  symbol?: string;
  side?: PositionSide;
  from?: string;
  to?: string;
  tag?: string;
  limit?: number;
};

export type JournalStatistics = {
  totalEntries: number;
  reviewedTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number | null;
  averageRealizedPnL: number | null;
  totalRealizedPnL: number | null;
  averageSetupRating: number | null;
  averageExecutionRating: number | null;
  averageDisciplineRating: number | null;
  mostCommonMistake: string | null;
  mostCommonEmotionalState: string | null;
  topTags: Array<{ tag: string; count: number }>;
};

export type JournalWorkspaceSnapshot = {
  entries: JournalEntryRecord[];
  statistics: JournalStatistics;
};

export type JournalReviewInput = {
  setupRating?: number | null;
  executionRating?: number | null;
  disciplineRating?: number | null;
  emotionalState?: string | null;
  mistakeType?: string | null;
  lesson?: string | null;
  whatWentWell?: string | null;
  whatWentWrong?: string | null;
  notes?: string | null;
  tags?: string[];
};

export type JournalManualCreateInput = JournalReviewInput & {
  symbol?: string | null;
  side?: PositionSide | null;
  entryPrice?: number | null;
  exitPrice?: number | null;
  quantity?: number | null;
  realizedPnL?: number | null;
  realizedPnLPercent?: number | null;
  entryTime?: string | null;
  exitTime?: string | null;
};
