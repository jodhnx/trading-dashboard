-- Phase 4 debug: Twelve Data does not accept DXY; DX is the working USD index symbol.

update public.assets
set provider_symbol = 'DX'
where symbol = 'USD';
