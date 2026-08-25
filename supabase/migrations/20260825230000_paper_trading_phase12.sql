-- Phase 12: simulated paper trading accounts and trade snapshots.
-- Reuses existing paper_positions / paper_trades from init schema.

create table public.paper_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  starting_balance numeric(18, 2) not null default 10000
    check (starting_balance >= 0 and starting_balance = starting_balance),
  cash_balance numeric(18, 2) not null default 10000
    check (cash_balance >= 0 and cash_balance = cash_balance),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create trigger paper_accounts_set_updated_at
before update on public.paper_accounts
for each row execute function public.set_updated_at();

alter table public.paper_positions
  add column account_id uuid references public.paper_accounts (id) on delete cascade;

alter table public.paper_trades
  add column setup_snapshot jsonb,
  add column stop_loss numeric(18, 8),
  add column take_profit numeric(18, 8),
  add column setup_score numeric(6, 2),
  add column position_value numeric(18, 2),
  add column status text not null default 'OPEN'
    check (status in ('OPEN', 'CLOSED')),
  add column close_reason text
    check (
      close_reason is null
      or close_reason in ('MANUAL', 'STOP_LOSS', 'TAKE_PROFIT')
    );

create unique index idx_paper_positions_open_symbol_side
  on public.paper_positions (user_id, asset_id, side)
  where status = 'OPEN';

create index idx_paper_positions_account
  on public.paper_positions (account_id)
  where status = 'OPEN';

create index idx_paper_trades_user_status
  on public.paper_trades (user_id, status, opened_at desc);

alter table public.paper_accounts enable row level security;

create policy paper_accounts_all_own on public.paper_accounts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
