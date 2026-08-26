-- Phase 17: Opportunity intelligence columns on existing opportunities table

alter table public.opportunities
  drop constraint if exists opportunities_decision_check;

alter table public.opportunities
  add constraint opportunities_decision_check
  check (decision in (
    'BUY_SETUP',
    'SHORT_SETUP',
    'WATCHLIST',
    'WATCH',
    'HOLD',
    'REDUCE',
    'EXIT',
    'NO_TRADE'
  ));

alter table public.opportunities
  add column if not exists opportunity_score numeric(5, 1)
    check (opportunity_score is null or (opportunity_score >= 0 and opportunity_score <= 100)),
  add column if not exists score_breakdown jsonb not null default '{}'::jsonb,
  add column if not exists asset_class text,
  add column if not exists setup_type text,
  add column if not exists holding_horizon text,
  add column if not exists opportunity_tier text,
  add column if not exists market_regime text,
  add column if not exists entry_zone_low numeric(18, 8),
  add column if not exists entry_zone_high numeric(18, 8),
  add column if not exists max_chase numeric(18, 8),
  add column if not exists scan_date date,
  add column if not exists data_status text,
  add column if not exists news_headlines text[] not null default '{}'::text[];

create index if not exists idx_opportunities_user_scan_date
  on public.opportunities (user_id, scan_date desc);

create index if not exists idx_opportunities_tier
  on public.opportunities (user_id, opportunity_tier, opportunity_score desc);

-- Seed opportunity universe assets (idempotent)
insert into public.assets (symbol, name, asset_type, exchange, currency, provider_symbol)
values
  ('IWM', 'iShares Russell 2000 ETF', 'ETF', 'NYSEARCA', 'USD', 'IWM'),
  ('XLK', 'Technology Select Sector SPDR', 'ETF', 'NYSEARCA', 'USD', 'XLK'),
  ('XLF', 'Financial Select Sector SPDR', 'ETF', 'NYSEARCA', 'USD', 'XLF'),
  ('XLE', 'Energy Select Sector SPDR', 'ETF', 'NYSEARCA', 'USD', 'XLE'),
  ('AAPL', 'Apple Inc.', 'STOCK', 'NASDAQ', 'USD', 'AAPL'),
  ('MSFT', 'Microsoft Corporation', 'STOCK', 'NASDAQ', 'USD', 'MSFT'),
  ('AMZN', 'Amazon.com Inc.', 'STOCK', 'NASDAQ', 'USD', 'AMZN'),
  ('META', 'Meta Platforms Inc.', 'STOCK', 'NASDAQ', 'USD', 'META'),
  ('TSLA', 'Tesla Inc.', 'STOCK', 'NASDAQ', 'USD', 'TSLA'),
  ('AMD', 'Advanced Micro Devices Inc.', 'STOCK', 'NASDAQ', 'USD', 'AMD'),
  ('JPM', 'JPMorgan Chase & Co.', 'STOCK', 'NYSE', 'USD', 'JPM'),
  ('XOM', 'Exxon Mobil Corporation', 'STOCK', 'NYSE', 'USD', 'XOM'),
  ('UNH', 'UnitedHealth Group Inc.', 'STOCK', 'NYSE', 'USD', 'UNH'),
  ('ETH', 'Ethereum', 'CRYPTO', 'Crypto', 'USD', 'ETH/USD'),
  ('SOL', 'Solana', 'CRYPTO', 'Crypto', 'USD', 'SOL/USD'),
  ('XRP', 'XRP', 'CRYPTO', 'Crypto', 'USD', 'XRP/USD'),
  ('LINK', 'Chainlink', 'CRYPTO', 'Crypto', 'USD', 'LINK/USD')
on conflict (symbol) do update
set
  provider_symbol = excluded.provider_symbol,
  name = excluded.name,
  asset_type = excluded.asset_type;
