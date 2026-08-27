import type {
  AiDecision,
  AssetType,
  BacktestStatus,
  BriefStatus,
  ImpactLevel,
  InformationType,
  NewsCategory,
  OpportunityStatus,
  PositionSide,
  PositionStatus,
  PredictionOutcome,
  ResearchStatus,
  Sentiment,
  Timeframe,
  TradingStyle,
} from "./enums";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProfileRow = {
  id: string;
  display_name: string | null;
  base_currency: string;
  created_at: string;
  updated_at: string;
};

export type UserSettingsRow = {
  id: string;
  user_id: string;
  capital: number;
  risk_per_trade: number;
  max_daily_risk: number;
  minimum_risk_reward: number;
  minimum_ai_score: number;
  max_open_positions: number;
  max_portfolio_exposure: number | null;
  trading_style: TradingStyle;
  preferred_markets: string[];
  preferred_assets: string[];
  notification_preferences: Json;
  created_at: string;
  updated_at: string;
};

export type AssetRow = {
  id: string;
  symbol: string;
  name: string;
  asset_type: AssetType;
  exchange: string | null;
  currency: string;
  provider_symbol: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SymbolUniverseRow = {
  id: string;
  symbol: string;
  provider_symbol: string | null;
  name: string;
  asset_type: AssetType;
  exchange: string | null;
  country: string;
  currency: string;
  market_cap: number | null;
  average_volume: number | null;
  tradable: boolean;
  provider_mapped: boolean;
  liquidity_tier: "HIGH" | "MEDIUM" | "LOW";
  is_leveraged_etf: boolean;
  is_high_risk: boolean;
  catalog_category: string | null;
  sector: string | null;
  industry: string | null;
  market: string | null;
  risk_hints: string[];
  last_seen: string;
  created_at: string;
  updated_at: string;
};

export type MarketDataRow = {
  id: string;
  asset_id: string;
  timestamp: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
  change: number | null;
  change_percent: number | null;
  source: string;
  timeframe: Timeframe;
  created_at: string;
};

export type MarketCandleRow = {
  id: string;
  asset_id: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  source: string;
  timeframe: Timeframe;
  created_at: string;
};

export type NewsRow = {
  id: string;
  asset_id: string | null;
  source_name: string;
  source_url: string | null;
  title: string;
  summary: string | null;
  published_at: string;
  retrieved_at: string;
  category: NewsCategory;
  relevance: number | null;
  sentiment: Sentiment;
  impact: ImpactLevel | null;
  content_hash: string;
  is_mock: boolean;
  created_at: string;
};

export type ResearchItemRow = {
  id: string;
  news_id: string | null;
  asset_id: string | null;
  source_name: string;
  source_url: string | null;
  published_at: string | null;
  retrieved_at: string;
  asset_symbol: string | null;
  headline: string | null;
  category: NewsCategory | null;
  relevance: number | null;
  impact: ImpactLevel | null;
  sentiment: Sentiment | null;
  summary: string | null;
  ai_interpretation: string | null;
  information_type: InformationType;
  research_status: ResearchStatus;
  content_hash: string | null;
  created_at: string;
};

export type AiAnalysisRow = {
  id: string;
  user_id: string;
  asset_id: string;
  analysis_timestamp: string;
  decision: AiDecision;
  score: number;
  confidence: number;
  trend: string | null;
  entry: number | null;
  stop_loss: number | null;
  take_profit_1: number | null;
  take_profit_2: number | null;
  risk_reward: number | null;
  reasons: string[];
  risks: string[];
  invalidation: string | null;
  news_impact: string | null;
  market_regime: string | null;
  model: string | null;
  prompt_version: string | null;
  data_timestamp: string | null;
  created_at: string;
  summary: string | null;
  thesis: string[];
  uncertainties: string[];
  supporting_signals: string[];
  contradicting_signals: string[];
  time_horizon: string | null;
  setup_reference: Json | null;
  input_snapshot: Json | null;
  timeframe: string | null;
  is_mock: boolean;
};

export type PipelineRunRow = {
  id: string;
  run_key: string;
  brief_date: string;
  status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";
  started_at: string;
  finished_at: string | null;
  assets_processed: number | null;
  ai_requests: number | null;
  news_inserted: number | null;
  error_summary: Json;
  result_summary: Json;
};

export type DailyBriefRow = {
  id: string;
  user_id: string;
  brief_date: string;
  market_regime: string | null;
  risk_environment: string | null;
  summary: string | null;
  important_news: Json;
  macro_events: Json;
  final_status: BriefStatus;
  generated_at: string;
  created_at: string;
  market_overview: Json;
  technical_conditions: Json;
  trading_setups: Json;
  ai_analyses: Json;
  top_opportunities: Json;
  watchlist: Json;
  no_trade_assets: Json;
  risks: string[];
  input_snapshot: Json | null;
  model: string | null;
  prompt_version: string | null;
  data_status: string | null;
  timezone: string;
  is_mock: boolean;
  ai_status: string | null;
};

export type OpportunityRow = {
  id: string;
  user_id: string;
  daily_brief_id: string | null;
  asset_id: string;
  decision: AiDecision;
  score: number;
  confidence: number;
  entry: number | null;
  stop_loss: number | null;
  take_profit_1: number | null;
  take_profit_2: number | null;
  risk_reward: number | null;
  position_size: number | null;
  risk_amount: number | null;
  reasons: string[];
  risks: string[];
  invalidation: string | null;
  status: OpportunityStatus;
  created_at: string;
  opportunity_score: number | null;
  score_breakdown: Json;
  asset_class: string | null;
  setup_type: string | null;
  holding_horizon: string | null;
  opportunity_tier: string | null;
  market_regime: string | null;
  entry_zone_low: number | null;
  entry_zone_high: number | null;
  max_chase: number | null;
  scan_date: string | null;
  data_status: string | null;
  news_headlines: string[];
};

export type PaperPositionRow = {
  id: string;
  user_id: string;
  account_id: string | null;
  asset_id: string;
  side: PositionSide;
  quantity: number;
  average_entry: number;
  current_price: number | null;
  stop_loss: number | null;
  take_profit_1: number | null;
  take_profit_2: number | null;
  status: PositionStatus;
  opened_at: string;
  updated_at: string;
};

export type PaperAccountRow = {
  id: string;
  user_id: string;
  starting_balance: number;
  cash_balance: number;
  created_at: string;
  updated_at: string;
};

export type PortfolioRow = {
  id: string;
  user_id: string;
  cash: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

export type PortfolioHoldingRow = {
  id: string;
  portfolio_id: string;
  user_id: string;
  asset_id: string;
  quantity: number;
  average_entry_price: number;
  created_at: string;
  updated_at: string;
};

export type PaperTradeRow = {
  id: string;
  user_id: string;
  position_id: string | null;
  asset_id: string;
  side: PositionSide;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  risk_amount: number | null;
  pnl: number | null;
  pnl_percent: number | null;
  r_multiple: number | null;
  entry_reason: string | null;
  exit_reason: string | null;
  strategy_id: string | null;
  ai_analysis_id: string | null;
  setup_snapshot: Json | null;
  stop_loss: number | null;
  take_profit: number | null;
  setup_score: number | null;
  position_value: number | null;
  status: "OPEN" | "CLOSED";
  close_reason: PaperCloseReason | null;
  opened_at: string;
  closed_at: string | null;
};

export const PAPER_CLOSE_REASONS = [
  "MANUAL",
  "STOP_LOSS",
  "TAKE_PROFIT",
] as const;
export type PaperCloseReason = (typeof PAPER_CLOSE_REASONS)[number];

export type JournalEntryRow = {
  id: string;
  user_id: string;
  paper_trade_id: string | null;
  asset_id: string | null;
  symbol: string | null;
  side: PositionSide | null;
  entry_price: number | null;
  exit_price: number | null;
  quantity: number | null;
  realized_pnl: number | null;
  realized_pnl_percent: number | null;
  entry_time: string | null;
  exit_time: string | null;
  notes: string | null;
  /** @deprecated use setup_rating */
  discipline_score: number | null;
  /** @deprecated use setup_rating */
  setup_quality: number | null;
  setup_rating: number | null;
  execution_rating: number | null;
  discipline_rating: number | null;
  emotional_state: string | null;
  mistake_type: string | null;
  /** @deprecated use lesson */
  mistakes: string | null;
  /** @deprecated use lesson */
  lessons: string | null;
  lesson: string | null;
  what_went_well: string | null;
  what_went_wrong: string | null;
  tags: string[];
  setup_snapshot: Json | null;
  setup_score: number | null;
  created_at: string;
  updated_at: string;
};

export type StrategyRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  config: Json;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BacktestRunRow = {
  id: string;
  user_id: string;
  strategy_id: string | null;
  asset_id: string | null;
  timeframe: Timeframe | null;
  start_date: string | null;
  end_date: string | null;
  initial_capital: number | null;
  final_capital: number | null;
  total_trades: number | null;
  win_rate: number | null;
  profit_factor: number | null;
  max_drawdown: number | null;
  average_r: number | null;
  status: BacktestStatus;
  created_at: string;
};

export type BacktestTradeRow = {
  id: string;
  user_id: string;
  backtest_run_id: string;
  asset_id: string | null;
  side: PositionSide;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  pnl: number | null;
  r_multiple: number | null;
  opened_at: string;
  closed_at: string | null;
};

export type MacroEventRow = {
  id: string;
  event_name: string;
  country: string | null;
  currency: string | null;
  importance: ImpactLevel | null;
  scheduled_at: string;
  actual_value: string | null;
  forecast_value: string | null;
  previous_value: string | null;
  source: string | null;
  created_at: string;
};

export type AiPredictionOutcomeRow = {
  id: string;
  user_id: string;
  opportunity_id: string | null;
  asset_id: string | null;
  predicted_decision: AiDecision;
  predicted_entry: number | null;
  predicted_stop: number | null;
  predicted_target: number | null;
  predicted_score: number | null;
  actual_outcome: PredictionOutcome;
  outcome_return: number | null;
  max_favorable_excursion: number | null;
  max_adverse_excursion: number | null;
  evaluated_at: string | null;
  created_at: string;
};

// Insert types allow optional fields that have DB defaults.
type PublicTables = {
  profiles: {
    Row: ProfileRow;
    Insert: Partial<ProfileRow> & Pick<ProfileRow, "id">;
    Update: Partial<ProfileRow>;
    Relationships: [];
  };
  user_settings: {
    Row: UserSettingsRow;
    Insert: Partial<UserSettingsRow> & Pick<UserSettingsRow, "user_id">;
    Update: Partial<UserSettingsRow>;
    Relationships: [];
  };
  assets: {
    Row: AssetRow;
    Insert: Partial<AssetRow> & Pick<AssetRow, "symbol" | "name" | "asset_type">;
    Update: Partial<AssetRow>;
    Relationships: [];
  };
  symbol_universe: {
    Row: SymbolUniverseRow;
    Insert: Partial<SymbolUniverseRow> &
      Pick<SymbolUniverseRow, "symbol" | "name" | "asset_type">;
    Update: Partial<SymbolUniverseRow>;
    Relationships: [];
  };
  market_data: {
    Row: MarketDataRow;
    Insert: Partial<MarketDataRow> &
      Pick<MarketDataRow, "asset_id" | "timestamp" | "close" | "source">;
    Update: Partial<MarketDataRow>;
    Relationships: [];
  };
  market_candles: {
    Row: MarketCandleRow;
    Insert: Partial<MarketCandleRow> &
      Pick<
        MarketCandleRow,
        "asset_id" | "timestamp" | "open" | "high" | "low" | "close" | "source" | "timeframe"
      >;
    Update: Partial<MarketCandleRow>;
    Relationships: [];
  };
  news: {
    Row: NewsRow;
    Insert: Partial<NewsRow> &
      Pick<NewsRow, "source_name" | "title" | "published_at" | "content_hash">;
    Update: Partial<NewsRow>;
    Relationships: [];
  };
  research_items: {
    Row: ResearchItemRow;
    Insert: Partial<ResearchItemRow> & Pick<ResearchItemRow, "source_name">;
    Update: Partial<ResearchItemRow>;
    Relationships: [];
  };
  ai_analyses: {
    Row: AiAnalysisRow;
    Insert: Partial<AiAnalysisRow> &
      Pick<AiAnalysisRow, "user_id" | "asset_id" | "decision" | "score" | "confidence">;
    Update: Partial<AiAnalysisRow>;
    Relationships: [];
  };
  daily_briefs: {
    Row: DailyBriefRow;
    Insert: Partial<DailyBriefRow> &
      Pick<DailyBriefRow, "user_id" | "brief_date" | "final_status">;
    Update: Partial<DailyBriefRow>;
    Relationships: [];
  };
  opportunities: {
    Row: OpportunityRow;
    Insert: Partial<OpportunityRow> &
      Pick<OpportunityRow, "user_id" | "asset_id" | "decision" | "score" | "confidence">;
    Update: Partial<OpportunityRow>;
    Relationships: [];
  };
  paper_positions: {
    Row: PaperPositionRow;
    Insert: Partial<PaperPositionRow> &
      Pick<
        PaperPositionRow,
        "user_id" | "asset_id" | "side" | "quantity" | "average_entry"
      >;
    Update: Partial<PaperPositionRow>;
    Relationships: [];
  };
  paper_accounts: {
    Row: PaperAccountRow;
    Insert: Partial<PaperAccountRow> & Pick<PaperAccountRow, "user_id">;
    Update: Partial<PaperAccountRow>;
    Relationships: [];
  };
  portfolios: {
    Row: PortfolioRow;
    Insert: Partial<PortfolioRow> & Pick<PortfolioRow, "user_id">;
    Update: Partial<PortfolioRow>;
    Relationships: [];
  };
  portfolio_holdings: {
    Row: PortfolioHoldingRow;
    Insert: Partial<PortfolioHoldingRow> &
      Pick<
        PortfolioHoldingRow,
        "portfolio_id" | "user_id" | "asset_id" | "quantity" | "average_entry_price"
      >;
    Update: Partial<PortfolioHoldingRow>;
    Relationships: [];
  };
  paper_trades: {
    Row: PaperTradeRow;
    Insert: Partial<PaperTradeRow> &
      Pick<PaperTradeRow, "user_id" | "asset_id" | "side" | "entry_price" | "quantity">;
    Update: Partial<PaperTradeRow>;
    Relationships: [];
  };
  journal_entries: {
    Row: JournalEntryRow;
    Insert: Partial<JournalEntryRow> & Pick<JournalEntryRow, "user_id">;
    Update: Partial<JournalEntryRow>;
    Relationships: [];
  };
  strategies: {
    Row: StrategyRow;
    Insert: Partial<StrategyRow> & Pick<StrategyRow, "user_id" | "name">;
    Update: Partial<StrategyRow>;
    Relationships: [];
  };
  backtest_runs: {
    Row: BacktestRunRow;
    Insert: Partial<BacktestRunRow> & Pick<BacktestRunRow, "user_id">;
    Update: Partial<BacktestRunRow>;
    Relationships: [];
  };
  backtest_trades: {
    Row: BacktestTradeRow;
    Insert: Partial<BacktestTradeRow> &
      Pick<
        BacktestTradeRow,
        "user_id" | "backtest_run_id" | "side" | "entry_price" | "quantity"
      >;
    Update: Partial<BacktestTradeRow>;
    Relationships: [];
  };
  macro_events: {
    Row: MacroEventRow;
    Insert: Partial<MacroEventRow> &
      Pick<MacroEventRow, "event_name" | "scheduled_at">;
    Update: Partial<MacroEventRow>;
    Relationships: [];
  };
  ai_prediction_outcomes: {
    Row: AiPredictionOutcomeRow;
    Insert: Partial<AiPredictionOutcomeRow> &
      Pick<AiPredictionOutcomeRow, "user_id" | "predicted_decision">;
    Update: Partial<AiPredictionOutcomeRow>;
    Relationships: [];
  };
  pipeline_runs: {
    Row: PipelineRunRow;
    Insert: Partial<PipelineRunRow> &
      Pick<PipelineRunRow, "run_key" | "brief_date" | "status">;
    Update: Partial<PipelineRunRow>;
    Relationships: [];
  };
};

export type Database = {
  public: {
    Tables: PublicTables;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export const PRIVATE_TABLES = [
  "profiles",
  "user_settings",
  "ai_analyses",
  "daily_briefs",
  "opportunities",
  "portfolios",
  "portfolio_holdings",
  "paper_accounts",
  "paper_positions",
  "paper_trades",
  "journal_entries",
  "strategies",
  "backtest_runs",
  "backtest_trades",
  "ai_prediction_outcomes",
] as const;

export const SHARED_TABLES = [
  "assets",
  "market_data",
  "market_candles",
  "news",
  "research_items",
  "macro_events",
] as const;

export type PrivateTable = (typeof PRIVATE_TABLES)[number];
export type SharedTable = (typeof SHARED_TABLES)[number];
