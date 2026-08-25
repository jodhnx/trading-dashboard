-- Phase 4: provider symbol mapping, 30min timeframe, quote change fields.

alter table public.assets
  add column if not exists provider_symbol text;

update public.assets
set provider_symbol = symbol
where provider_symbol is null;

update public.assets
set
  symbol = 'BTC',
  provider_symbol = 'BTC/USD',
  name = 'Bitcoin'
where symbol in ('BTC/USD', 'BTC');

update public.assets
set
  symbol = 'XAU',
  provider_symbol = 'XAU/USD',
  name = 'Gold Spot'
where symbol in ('XAU/USD', 'XAU');

insert into public.assets (symbol, name, asset_type, exchange, currency, provider_symbol)
values
  ('SPY', 'SPDR S&P 500 ETF Trust', 'ETF', 'NYSEARCA', 'USD', 'SPY'),
  ('QQQ', 'Invesco QQQ Trust', 'ETF', 'NASDAQ', 'USD', 'QQQ'),
  ('NVDA', 'NVIDIA Corporation', 'STOCK', 'NASDAQ', 'USD', 'NVDA'),
  ('BTC', 'Bitcoin', 'CRYPTO', 'Crypto', 'USD', 'BTC/USD'),
  ('XAU', 'Gold Spot', 'COMMODITY', 'FOREXCOM', 'USD', 'XAU/USD'),
  ('USD', 'US Dollar Index', 'INDEX', 'CBOE', 'USD', 'DXY')
on conflict (symbol, exchange) do update
set provider_symbol = excluded.provider_symbol;

create unique index if not exists idx_assets_symbol_unique on public.assets (symbol);

alter table public.market_data
  add column if not exists change numeric(18, 8),
  add column if not exists change_percent numeric(12, 6);

alter table public.market_data drop constraint if exists market_data_timeframe_check;
alter table public.market_data
  add constraint market_data_timeframe_check
  check (timeframe in ('1min', '5min', '15min', '30min', '1h', '4h', '1day', '1week'));

alter table public.market_candles drop constraint if exists market_candles_timeframe_check;
alter table public.market_candles
  add constraint market_candles_timeframe_check
  check (timeframe in ('1min', '5min', '15min', '30min', '1h', '4h', '1day', '1week'));
