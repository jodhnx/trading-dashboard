-- Phase 19: expand opportunity universe asset seeds

insert into public.assets (symbol, name, asset_type, exchange, currency, provider_symbol)
values
  ('DIA', 'SPDR Dow Jones Industrial Average ETF', 'ETF', 'NYSEARCA', 'USD', 'DIA'),
  ('GOOGL', 'Alphabet Inc. Class A', 'STOCK', 'NASDAQ', 'USD', 'GOOGL'),
  ('AVGO', 'Broadcom Inc.', 'STOCK', 'NASDAQ', 'USD', 'AVGO'),
  ('NFLX', 'Netflix Inc.', 'STOCK', 'NASDAQ', 'USD', 'NFLX'),
  ('V', 'Visa Inc.', 'STOCK', 'NYSE', 'USD', 'V'),
  ('MA', 'Mastercard Inc.', 'STOCK', 'NYSE', 'USD', 'MA'),
  ('COST', 'Costco Wholesale Corporation', 'STOCK', 'NASDAQ', 'USD', 'COST'),
  ('BNB', 'BNB', 'CRYPTO', 'Crypto', 'USD', 'BNB/USD'),
  ('DOGE', 'Dogecoin', 'CRYPTO', 'Crypto', 'USD', 'DOGE/USD')
on conflict (symbol) do update
set
  provider_symbol = excluded.provider_symbol,
  name = excluded.name,
  asset_type = excluded.asset_type,
  exchange = excluded.exchange,
  currency = excluded.currency;
