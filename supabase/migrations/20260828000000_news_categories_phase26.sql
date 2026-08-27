-- Phase 26: expanded deterministic news categories for daily market screener

alter table public.news drop constraint if exists news_category_check;

alter table public.news
  add constraint news_category_check
  check (category in (
    'EARNINGS', 'GUIDANCE', 'REVENUE', 'PRODUCT', 'AI', 'PARTNERSHIP',
    'ACQUISITION', 'MERGER', 'REGULATION', 'LEGAL', 'MACRO', 'INTEREST_RATES',
    'INFLATION', 'ETF', 'CRYPTO_ETF', 'TOKEN_UNLOCK', 'NETWORK_UPGRADE',
    'SECURITY', 'HACK', 'EXCHANGE', 'ADOPTION', 'INSIDER', 'ANALYST',
    'UPGRADE', 'DOWNGRADE', 'BREAKOUT_CATALYST', 'RATES', 'COMPANY', 'CRYPTO',
    'GEOPOLITICAL', 'MARKET', 'OTHER'
  ));

alter table public.news drop constraint if exists news_sentiment_check;
alter table public.news
  add constraint news_sentiment_check
  check (sentiment in ('POSITIVE', 'NEGATIVE', 'NEUTRAL', 'MIXED', 'UNKNOWN'));

alter table public.research_items drop constraint if exists research_items_category_check;

alter table public.research_items
  add constraint research_items_category_check
  check (category in (
    'EARNINGS', 'GUIDANCE', 'REVENUE', 'PRODUCT', 'AI', 'PARTNERSHIP',
    'ACQUISITION', 'MERGER', 'REGULATION', 'LEGAL', 'MACRO', 'INTEREST_RATES',
    'INFLATION', 'ETF', 'CRYPTO_ETF', 'TOKEN_UNLOCK', 'NETWORK_UPGRADE',
    'SECURITY', 'HACK', 'EXCHANGE', 'ADOPTION', 'INSIDER', 'ANALYST',
    'UPGRADE', 'DOWNGRADE', 'BREAKOUT_CATALYST', 'RATES', 'COMPANY', 'CRYPTO',
    'GEOPOLITICAL', 'MARKET', 'OTHER'
  ));
