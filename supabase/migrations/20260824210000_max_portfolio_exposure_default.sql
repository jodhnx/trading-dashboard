-- Enable the existing max_portfolio_exposure column as max position size.
-- Fraction in the database (0.20 = 20%). UI shows percent.

alter table public.user_settings
  alter column max_portfolio_exposure set default 0.20;

update public.user_settings
  set max_portfolio_exposure = 0.20
  where max_portfolio_exposure is null;
