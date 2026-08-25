-- Phase 16: daily pipeline run tracking and concurrency lock

create table public.pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  brief_date date not null,
  status text not null check (status in ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED', 'SKIPPED')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  assets_processed integer,
  ai_requests integer,
  news_inserted integer,
  error_summary jsonb not null default '{}'::jsonb,
  result_summary jsonb not null default '{}'::jsonb
);

create index idx_pipeline_runs_brief_date on public.pipeline_runs (brief_date desc);
create index idx_pipeline_runs_status on public.pipeline_runs (status);

alter table public.pipeline_runs enable row level security;

-- Service role only — no user-facing policies
