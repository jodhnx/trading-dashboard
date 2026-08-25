-- Phase 9: Daily Brief payload columns on existing daily_briefs.
-- unique (user_id, brief_date) already prevents duplicates.

alter table public.daily_briefs
  add column if not exists market_overview jsonb not null default '[]'::jsonb,
  add column if not exists technical_conditions jsonb not null default '[]'::jsonb,
  add column if not exists trading_setups jsonb not null default '[]'::jsonb,
  add column if not exists ai_analyses jsonb not null default '[]'::jsonb,
  add column if not exists top_opportunities jsonb not null default '[]'::jsonb,
  add column if not exists watchlist jsonb not null default '[]'::jsonb,
  add column if not exists no_trade_assets jsonb not null default '[]'::jsonb,
  add column if not exists risks text[] not null default '{}'::text[],
  add column if not exists input_snapshot jsonb,
  add column if not exists model text,
  add column if not exists prompt_version text,
  add column if not exists data_status text
    check (data_status is null or data_status in (
      'LIVE', 'CACHED', 'STALE', 'MIXED', 'UNAVAILABLE', 'MOCK'
    )),
  add column if not exists timezone text not null default 'UTC',
  add column if not exists is_mock boolean not null default false,
  add column if not exists ai_status text
    check (ai_status is null or ai_status in (
      'ok', 'AI_UNAVAILABLE', 'AI_TIMEOUT', 'AI_ANALYSIS_INVALID', 'SKIPPED'
    ));
