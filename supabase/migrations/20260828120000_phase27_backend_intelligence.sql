-- Phase 27: expanded catalog metadata, AI research, freshness timestamps

alter table public.symbol_universe
  add column if not exists catalog_category text,
  add column if not exists sector text,
  add column if not exists industry text,
  add column if not exists market text,
  add column if not exists risk_hints text[] not null default '{}'::text[];

create index if not exists idx_symbol_universe_category
  on public.symbol_universe (catalog_category)
  where catalog_category is not null;

create index if not exists idx_symbol_universe_sector
  on public.symbol_universe (sector)
  where sector is not null;

comment on column public.symbol_universe.catalog_category is
  'Phase 27 structured catalog category (US_LARGE_CAP, SEMICONDUCTOR, CRYPTO, etc.)';

comment on column public.symbol_universe.risk_hints is
  'Deterministic risk hints such as LEVERAGED or CRYPTO_VOLATILITY';

-- Opportunities JSON breakdown already stores Phase 27 fields:
-- marketUpdatedAt, technicalCalculatedAt, newsUpdatedAt, aiAnalyzedAt, aiResearch

alter table public.news drop constraint if exists news_category_check;

alter table public.news
  add constraint news_category_check
  check (category in (
    'EARNINGS', 'GUIDANCE', 'REVENUE', 'PRODUCT', 'AI', 'PARTNERSHIP',
    'ACQUISITION', 'MERGER', 'REGULATION', 'LEGAL', 'MACRO', 'INTEREST_RATES',
    'INFLATION', 'ETF', 'CRYPTO_ETF', 'TOKEN_UNLOCK', 'NETWORK_UPGRADE',
    'SECURITY', 'HACK', 'EXCHANGE', 'ADOPTION', 'INSIDER', 'ANALYST',
    'UPGRADE', 'DOWNGRADE', 'BREAKOUT_CATALYST', 'RATES', 'COMPANY', 'CRYPTO',
    'GEOPOLITICAL', 'MARKET', 'DIVIDEND', 'STOCK_BUYBACK', 'CRYPTO_REGULATION',
    'LIQUIDITY', 'SEMICONDUCTOR', 'CENTRAL_BANK', 'OTHER'
  ));

alter table public.research_items drop constraint if exists research_items_category_check;

alter table public.research_items
  add constraint research_items_category_check
  check (category in (
    'EARNINGS', 'GUIDANCE', 'REVENUE', 'PRODUCT', 'AI', 'PARTNERSHIP',
    'ACQUISITION', 'MERGER', 'REGULATION', 'LEGAL', 'MACRO', 'INTEREST_RATES',
    'INFLATION', 'ETF', 'CRYPTO_ETF', 'TOKEN_UNLOCK', 'NETWORK_UPGRADE',
    'SECURITY', 'HACK', 'EXCHANGE', 'ADOPTION', 'INSIDER', 'ANALYST',
    'UPGRADE', 'DOWNGRADE', 'BREAKOUT_CATALYST', 'RATES', 'COMPANY', 'CRYPTO',
    'GEOPOLITICAL', 'MARKET', 'DIVIDEND', 'STOCK_BUYBACK', 'CRYPTO_REGULATION',
    'LIQUIDITY', 'SEMICONDUCTOR', 'CENTRAL_BANK', 'OTHER'
  ));
