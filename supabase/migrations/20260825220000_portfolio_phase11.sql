-- Phase 11: personal portfolio tracking (not paper trading / not broker orders).

create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  cash numeric(18, 2) not null default 0
    check (cash >= 0 and cash = cash),
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table public.portfolio_holdings (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  asset_id uuid not null references public.assets (id) on delete restrict,
  quantity numeric(18, 8) not null
    check (quantity > 0 and quantity = quantity),
  average_entry_price numeric(18, 8) not null
    check (average_entry_price > 0 and average_entry_price = average_entry_price),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (portfolio_id, asset_id)
);

create index idx_portfolio_holdings_user
  on public.portfolio_holdings (user_id);
create index idx_portfolio_holdings_portfolio
  on public.portfolio_holdings (portfolio_id);

create trigger portfolios_set_updated_at
before update on public.portfolios
for each row execute function public.set_updated_at();

create trigger portfolio_holdings_set_updated_at
before update on public.portfolio_holdings
for each row execute function public.set_updated_at();

alter table public.portfolios enable row level security;
alter table public.portfolio_holdings enable row level security;

create policy portfolios_all_own on public.portfolios
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy portfolio_holdings_all_own on public.portfolio_holdings
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
