-- Phase 8: structured trading analyses on existing ai_analyses.

alter table public.ai_analyses
  drop constraint if exists ai_analyses_decision_check;

alter table public.ai_analyses
  add constraint ai_analyses_decision_check
  check (decision in (
    'BUY_SETUP',
    'SHORT_SETUP',
    'WATCHLIST',
    'NO_TRADE',
    'WATCH',
    'HOLD',
    'REDUCE',
    'EXIT'
  ));

alter table public.ai_analyses
  drop constraint if exists ai_analyses_confidence_check;

alter table public.ai_analyses
  add constraint ai_analyses_confidence_check
  check (confidence >= 0 and confidence <= 100);

alter table public.ai_analyses
  drop constraint if exists ai_analyses_score_check;

alter table public.ai_analyses
  add constraint ai_analyses_score_check
  check (score >= 0 and score <= 100);

alter table public.ai_analyses
  add column if not exists summary text,
  add column if not exists thesis text[] not null default '{}'::text[],
  add column if not exists uncertainties text[] not null default '{}'::text[],
  add column if not exists supporting_signals text[] not null default '{}'::text[],
  add column if not exists contradicting_signals text[] not null default '{}'::text[],
  add column if not exists time_horizon text
    check (time_horizon is null or time_horizon in ('INTRADAY', 'SWING', 'UNKNOWN')),
  add column if not exists setup_reference jsonb,
  add column if not exists input_snapshot jsonb,
  add column if not exists timeframe text,
  add column if not exists is_mock boolean not null default false;
