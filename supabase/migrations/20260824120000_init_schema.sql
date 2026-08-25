-- Phase 2 schema: tables, constraints, indexes, triggers, RLS.
-- Apply in the Supabase SQL editor or via `npx supabase db push`.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    )
  );

  insert into public.user_settings (user_id)
  values (new.id);

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles  (1:1 with auth.users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  base_currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_settings
-- ---------------------------------------------------------------------------

create table public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  capital numeric(18, 2) not null default 10000 check (capital >= 0),
  risk_per_trade numeric(8, 4) not null default 0.005
    check (risk_per_trade > 0 and risk_per_trade <= 1),
  max_daily_risk numeric(8, 4) not null default 0.015
    check (max_daily_risk > 0 and max_daily_risk <= 1),
  minimum_risk_reward numeric(8, 4) not null default 2
    check (minimum_risk_reward > 0),
  minimum_ai_score numeric(4, 1) not null default 7
    check (minimum_ai_score >= 0 and minimum_ai_score <= 10),
  max_open_positions integer not null default 5
    check (max_open_positions > 0),
  max_portfolio_exposure numeric(8, 4)
    check (max_portfolio_exposure is null or (max_portfolio_exposure > 0 and max_portfolio_exposure <= 1)),
  trading_style text not null default 'SWING'
    check (trading_style in ('SCALP', 'DAY', 'SWING', 'POSITION')),
  preferred_markets text[] not null default array['STOCKS', 'ETFS', 'CRYPTO', 'INDICES', 'COMMODITIES']::text[],
  preferred_assets text[] not null default '{}'::text[],
  notification_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_user_settings_user_id on public.user_settings (user_id);

create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- assets (shared reference data)
-- ---------------------------------------------------------------------------

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  name text not null,
  asset_type text not null
    check (asset_type in ('STOCK', 'ETF', 'CRYPTO', 'INDEX', 'COMMODITY', 'FOREX')),
  exchange text,
  currency text not null default 'USD',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (symbol, exchange)
);

create index idx_assets_symbol on public.assets (symbol);
create index idx_assets_type_active on public.assets (asset_type, is_active);

create trigger assets_set_updated_at
before update on public.assets
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- market_data / market_candles
-- ---------------------------------------------------------------------------

create table public.market_data (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  timestamp timestamptz not null,
  open numeric(18, 8),
  high numeric(18, 8),
  low numeric(18, 8),
  close numeric(18, 8) not null,
  volume numeric(28, 8),
  source text not null,
  timeframe text not null default '1min'
    check (timeframe in ('1min', '5min', '15min', '1h', '4h', '1day', '1week')),
  created_at timestamptz not null default now(),
  unique (asset_id, timestamp, timeframe, source)
);

create index idx_market_data_asset_time
  on public.market_data (asset_id, timeframe, timestamp desc);

create table public.market_candles (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  timestamp timestamptz not null,
  open numeric(18, 8) not null,
  high numeric(18, 8) not null,
  low numeric(18, 8) not null,
  close numeric(18, 8) not null,
  volume numeric(28, 8),
  source text not null,
  timeframe text not null
    check (timeframe in ('1min', '5min', '15min', '1h', '4h', '1day', '1week')),
  created_at timestamptz not null default now(),
  unique (asset_id, timestamp, timeframe, source),
  check (high >= low)
);

create index idx_market_candles_asset_time
  on public.market_candles (asset_id, timeframe, timestamp desc);

-- ---------------------------------------------------------------------------
-- news / research / macro
-- ---------------------------------------------------------------------------

create table public.news (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.assets (id) on delete set null,
  source_name text not null,
  source_url text,
  title text not null,
  summary text,
  published_at timestamptz not null,
  retrieved_at timestamptz not null default now(),
  category text not null default 'other'
    check (category in (
      'earnings', 'macro', 'rates', 'inflation', 'regulation',
      'company', 'crypto', 'geopolitical', 'market', 'other'
    )),
  relevance numeric(4, 1)
    check (relevance is null or (relevance >= 0 and relevance <= 10)),
  sentiment text not null default 'UNKNOWN'
    check (sentiment in ('POSITIVE', 'NEGATIVE', 'NEUTRAL', 'UNKNOWN')),
  impact text
    check (impact is null or impact in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  content_hash text not null unique,
  created_at timestamptz not null default now()
);

create index idx_news_published_at on public.news (published_at desc);
create index idx_news_asset_published on public.news (asset_id, published_at desc);
create index idx_news_category on public.news (category, published_at desc);

create table public.research_items (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.assets (id) on delete set null,
  source_name text not null,
  source_url text,
  published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  asset_symbol text,
  relevance numeric(4, 1)
    check (relevance is null or (relevance >= 0 and relevance <= 10)),
  summary text,
  ai_interpretation text,
  information_type text not null default 'FACT'
    check (information_type in ('FACT', 'AI_INTERPRETATION')),
  created_at timestamptz not null default now()
);

create index idx_research_items_asset on public.research_items (asset_id, published_at desc);
create index idx_research_items_retrieved on public.research_items (retrieved_at desc);

create table public.macro_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  country text,
  currency text,
  importance text
    check (importance is null or importance in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  scheduled_at timestamptz not null,
  actual_value text,
  forecast_value text,
  previous_value text,
  source text,
  created_at timestamptz not null default now()
);

create index idx_macro_events_scheduled on public.macro_events (scheduled_at);

-- ---------------------------------------------------------------------------
-- AI analyses / daily briefs / opportunities
-- ---------------------------------------------------------------------------

create table public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete restrict,
  analysis_timestamp timestamptz not null default now(),
  decision text not null
    check (decision in ('BUY_SETUP', 'WATCH', 'HOLD', 'REDUCE', 'EXIT', 'NO_TRADE')),
  score numeric(4, 1) not null check (score >= 0 and score <= 10),
  confidence numeric(4, 1) not null check (confidence >= 0 and confidence <= 10),
  trend text,
  entry numeric(18, 8),
  stop_loss numeric(18, 8),
  take_profit_1 numeric(18, 8),
  take_profit_2 numeric(18, 8),
  risk_reward numeric(8, 4),
  reasons text[] not null default '{}'::text[],
  risks text[] not null default '{}'::text[],
  invalidation text,
  news_impact text,
  market_regime text,
  model text,
  prompt_version text,
  data_timestamp timestamptz,
  created_at timestamptz not null default now()
);

create index idx_ai_analyses_user_asset
  on public.ai_analyses (user_id, asset_id, analysis_timestamp desc);
create index idx_ai_analyses_user_created
  on public.ai_analyses (user_id, created_at desc);

create table public.daily_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  brief_date date not null,
  market_regime text,
  risk_environment text,
  summary text,
  important_news jsonb not null default '[]'::jsonb,
  macro_events jsonb not null default '[]'::jsonb,
  final_status text not null
    check (final_status in ('TRADE', 'WATCH', 'NO_TRADE')),
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, brief_date)
);

create index idx_daily_briefs_user_date on public.daily_briefs (user_id, brief_date desc);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  daily_brief_id uuid references public.daily_briefs (id) on delete set null,
  asset_id uuid not null references public.assets (id) on delete restrict,
  decision text not null
    check (decision in ('BUY_SETUP', 'WATCH', 'HOLD', 'REDUCE', 'EXIT', 'NO_TRADE')),
  score numeric(4, 1) not null check (score >= 0 and score <= 10),
  confidence numeric(4, 1) not null check (confidence >= 0 and confidence <= 10),
  entry numeric(18, 8),
  stop_loss numeric(18, 8),
  take_profit_1 numeric(18, 8),
  take_profit_2 numeric(18, 8),
  risk_reward numeric(8, 4),
  position_size numeric(18, 8),
  risk_amount numeric(18, 2),
  reasons text[] not null default '{}'::text[],
  risks text[] not null default '{}'::text[],
  invalidation text,
  status text not null default 'NEW'
    check (status in ('NEW', 'VALID', 'INVALID', 'REJECTED', 'TAKEN', 'EXPIRED', 'CLOSED')),
  created_at timestamptz not null default now()
);

create index idx_opportunities_user_status
  on public.opportunities (user_id, status, created_at desc);
create index idx_opportunities_brief on public.opportunities (daily_brief_id);

-- ---------------------------------------------------------------------------
-- Paper trading / journal
-- ---------------------------------------------------------------------------

create table public.paper_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete restrict,
  side text not null check (side in ('LONG', 'SHORT')),
  quantity numeric(18, 8) not null check (quantity > 0),
  average_entry numeric(18, 8) not null,
  current_price numeric(18, 8),
  stop_loss numeric(18, 8),
  take_profit_1 numeric(18, 8),
  take_profit_2 numeric(18, 8),
  status text not null default 'OPEN'
    check (status in ('OPEN', 'CLOSED', 'CANCELLED')),
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_paper_positions_user_status
  on public.paper_positions (user_id, status);
create index idx_paper_positions_asset on public.paper_positions (asset_id);

create trigger paper_positions_set_updated_at
before update on public.paper_positions
for each row execute function public.set_updated_at();

create table public.strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_strategies_user on public.strategies (user_id, is_active);

create trigger strategies_set_updated_at
before update on public.strategies
for each row execute function public.set_updated_at();

create table public.paper_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  position_id uuid references public.paper_positions (id) on delete set null,
  asset_id uuid not null references public.assets (id) on delete restrict,
  side text not null check (side in ('LONG', 'SHORT')),
  entry_price numeric(18, 8) not null,
  exit_price numeric(18, 8),
  quantity numeric(18, 8) not null check (quantity > 0),
  risk_amount numeric(18, 2),
  pnl numeric(18, 2),
  pnl_percent numeric(12, 6),
  r_multiple numeric(12, 4),
  entry_reason text,
  exit_reason text,
  strategy_id uuid references public.strategies (id) on delete set null,
  ai_analysis_id uuid references public.ai_analyses (id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  check (closed_at is null or closed_at >= opened_at)
);

create index idx_paper_trades_user_opened on public.paper_trades (user_id, opened_at desc);
create index idx_paper_trades_position on public.paper_trades (position_id);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  paper_trade_id uuid references public.paper_trades (id) on delete set null,
  notes text,
  discipline_score numeric(4, 1)
    check (discipline_score is null or (discipline_score >= 0 and discipline_score <= 10)),
  setup_quality numeric(4, 1)
    check (setup_quality is null or (setup_quality >= 0 and setup_quality <= 10)),
  mistakes text,
  lessons text,
  created_at timestamptz not null default now()
);

create index idx_journal_entries_user on public.journal_entries (user_id, created_at desc);
create index idx_journal_entries_trade on public.journal_entries (paper_trade_id);

-- ---------------------------------------------------------------------------
-- Backtesting
-- ---------------------------------------------------------------------------

create table public.backtest_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  strategy_id uuid references public.strategies (id) on delete set null,
  asset_id uuid references public.assets (id) on delete set null,
  timeframe text
    check (timeframe is null or timeframe in ('1min', '5min', '15min', '1h', '4h', '1day', '1week')),
  start_date date,
  end_date date,
  initial_capital numeric(18, 2),
  final_capital numeric(18, 2),
  total_trades integer,
  win_rate numeric(8, 4),
  profit_factor numeric(12, 4),
  max_drawdown numeric(12, 6),
  average_r numeric(12, 4),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
  created_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create index idx_backtest_runs_user on public.backtest_runs (user_id, created_at desc);
create index idx_backtest_runs_strategy on public.backtest_runs (strategy_id);

create table public.backtest_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  backtest_run_id uuid not null references public.backtest_runs (id) on delete cascade,
  asset_id uuid references public.assets (id) on delete set null,
  side text not null check (side in ('LONG', 'SHORT')),
  entry_price numeric(18, 8) not null,
  exit_price numeric(18, 8),
  quantity numeric(18, 8) not null check (quantity > 0),
  pnl numeric(18, 2),
  r_multiple numeric(12, 4),
  opened_at timestamptz not null,
  closed_at timestamptz
);

create index idx_backtest_trades_run on public.backtest_trades (backtest_run_id, opened_at);
create index idx_backtest_trades_user on public.backtest_trades (user_id);

-- ---------------------------------------------------------------------------
-- AI prediction outcomes
-- ---------------------------------------------------------------------------

create table public.ai_prediction_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  asset_id uuid references public.assets (id) on delete set null,
  predicted_decision text not null
    check (predicted_decision in ('BUY_SETUP', 'WATCH', 'HOLD', 'REDUCE', 'EXIT', 'NO_TRADE')),
  predicted_entry numeric(18, 8),
  predicted_stop numeric(18, 8),
  predicted_target numeric(18, 8),
  predicted_score numeric(4, 1),
  actual_outcome text not null default 'PENDING'
    check (actual_outcome in ('PENDING', 'WIN', 'LOSS', 'BREAKEVEN', 'EXPIRED', 'UNKNOWN')),
  outcome_return numeric(12, 6),
  max_favorable_excursion numeric(12, 6),
  max_adverse_excursion numeric(12, 6),
  evaluated_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_ai_prediction_outcomes_user
  on public.ai_prediction_outcomes (user_id, created_at desc);
create index idx_ai_prediction_outcomes_opportunity
  on public.ai_prediction_outcomes (opportunity_id);

-- ---------------------------------------------------------------------------
-- Auth → profile + settings
-- ---------------------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Seed reference assets (shared, not user-specific)
-- ---------------------------------------------------------------------------

insert into public.assets (symbol, name, asset_type, exchange, currency)
values
  ('SPY', 'SPDR S&P 500 ETF Trust', 'ETF', 'NYSEARCA', 'USD'),
  ('QQQ', 'Invesco QQQ Trust', 'ETF', 'NASDAQ', 'USD'),
  ('NVDA', 'NVIDIA Corporation', 'STOCK', 'NASDAQ', 'USD'),
  ('BTC/USD', 'Bitcoin', 'CRYPTO', 'Crypto', 'USD'),
  ('XAU/USD', 'Gold Spot', 'COMMODITY', 'FOREXCOM', 'USD')
on conflict (symbol, exchange) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Private tables: owner-only. Shared tables: authenticated SELECT only.
-- service_role bypasses RLS (cron / admin writes).
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.assets enable row level security;
alter table public.market_data enable row level security;
alter table public.market_candles enable row level security;
alter table public.news enable row level security;
alter table public.research_items enable row level security;
alter table public.macro_events enable row level security;
alter table public.ai_analyses enable row level security;
alter table public.daily_briefs enable row level security;
alter table public.opportunities enable row level security;
alter table public.paper_positions enable row level security;
alter table public.paper_trades enable row level security;
alter table public.journal_entries enable row level security;
alter table public.strategies enable row level security;
alter table public.backtest_runs enable row level security;
alter table public.backtest_trades enable row level security;
alter table public.ai_prediction_outcomes enable row level security;

-- Private: owner policies (no USING (true))
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy user_settings_select_own on public.user_settings
  for select to authenticated using (user_id = auth.uid());
create policy user_settings_update_own on public.user_settings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_settings_insert_own on public.user_settings
  for insert to authenticated with check (user_id = auth.uid());

create policy ai_analyses_all_own on public.ai_analyses
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy daily_briefs_all_own on public.daily_briefs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy opportunities_all_own on public.opportunities
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy paper_positions_all_own on public.paper_positions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy paper_trades_all_own on public.paper_trades
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy journal_entries_all_own on public.journal_entries
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy strategies_all_own on public.strategies
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy backtest_runs_all_own on public.backtest_runs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy backtest_trades_all_own on public.backtest_trades
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy ai_prediction_outcomes_all_own on public.ai_prediction_outcomes
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Shared reference data: authenticated read only. Writes go through service_role.
create policy assets_select_authenticated on public.assets
  for select to authenticated using (true);

create policy market_data_select_authenticated on public.market_data
  for select to authenticated using (true);

create policy market_candles_select_authenticated on public.market_candles
  for select to authenticated using (true);

create policy news_select_authenticated on public.news
  for select to authenticated using (true);

create policy research_items_select_authenticated on public.research_items
  for select to authenticated using (true);

create policy macro_events_select_authenticated on public.macro_events
  for select to authenticated using (true);
