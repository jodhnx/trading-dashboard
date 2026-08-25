-- Phase 13: extend journal_entries for full trading journal review layer.

alter table public.journal_entries
  add column asset_id uuid references public.assets (id) on delete set null,
  add column symbol text,
  add column side text check (side is null or side in ('LONG', 'SHORT')),
  add column entry_price numeric(18, 8),
  add column exit_price numeric(18, 8),
  add column quantity numeric(18, 8)
    check (quantity is null or quantity > 0),
  add column realized_pnl numeric(18, 2),
  add column realized_pnl_percent numeric(12, 6),
  add column entry_time timestamptz,
  add column exit_time timestamptz,
  add column setup_rating numeric(4, 1)
    check (setup_rating is null or (setup_rating >= 0 and setup_rating <= 10)),
  add column execution_rating numeric(4, 1)
    check (execution_rating is null or (execution_rating >= 0 and execution_rating <= 10)),
  add column discipline_rating numeric(4, 1)
    check (discipline_rating is null or (discipline_rating >= 0 and discipline_rating <= 10)),
  add column emotional_state text,
  add column mistake_type text,
  add column lesson text,
  add column what_went_well text,
  add column what_went_wrong text,
  add column tags text[] not null default '{}'::text[],
  add column setup_snapshot jsonb,
  add column setup_score numeric(6, 2),
  add column updated_at timestamptz not null default now();

-- Backfill legacy review fields into Phase-13 columns where present.
update public.journal_entries
set
  setup_rating = setup_quality,
  discipline_rating = discipline_score,
  lesson = lessons,
  what_went_wrong = mistakes
where setup_rating is null
  and (
    setup_quality is not null
    or discipline_score is not null
    or lessons is not null
    or mistakes is not null
  );

create unique index idx_journal_entries_unique_paper_trade
  on public.journal_entries (user_id, paper_trade_id)
  where paper_trade_id is not null;

create index idx_journal_entries_symbol
  on public.journal_entries (user_id, symbol, created_at desc);

create index idx_journal_entries_side
  on public.journal_entries (user_id, side, created_at desc);

create trigger journal_entries_set_updated_at
before update on public.journal_entries
for each row execute function public.set_updated_at();
