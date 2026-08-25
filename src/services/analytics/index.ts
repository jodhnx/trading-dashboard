export {
  getAnalyticsViewModel,
  httpStatusForAnalyticsError,
} from "./service";
export {
  computePaperPerformanceSummary,
  groupPaperTradesByAsset,
  groupPaperTradesBySide,
  groupPaperTradesByScore,
  groupPaperTradesByExitReason,
  buildPaperEquityCurve,
} from "./paper-performance";
export { buildJournalAnalyticsSection, computeJournalRatingGroups } from "./journal-performance";
export { buildBacktestAnalyticsSection } from "./backtest-performance";
export {
  resolveAnalyticsDateRange,
  isTimestampInRange,
  formatUtcDate,
  parseUtcDate,
} from "./date";
export {
  computeMaxDrawdownFromCurve,
  average,
  profitFactor,
  winRate,
} from "./drawdown";
export { analyticsQuerySchema } from "./validation";
export {
  formatAnalyticsMoney,
  formatAnalyticsPercent,
  formatAnalyticsRatio,
  formatAnalyticsDate,
  pnlClass,
  exitReasonLabel,
  presetLabel,
  winRateLabel,
} from "./view-model";
export {
  ANALYTICS_PRESETS,
  ANALYTICS_DATASETS,
  ANALYTICS_SYMBOLS,
  SCORE_BUCKETS,
} from "./constants";
export type {
  AnalyticsViewModel,
  AnalyticsFilters,
  AnalyticsPreset,
  AnalyticsDataset,
  PaperPerformanceSummary,
  PaperAnalyticsSection,
  JournalAnalyticsSection,
  BacktestAnalyticsSection,
  AnalyticsErrorCode,
} from "./types";
