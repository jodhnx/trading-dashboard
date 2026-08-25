-- USD is an internal code. Twelve Data does not serve DXY; DX is Dynex Capital.

update public.assets
set provider_symbol = null
where symbol = 'USD';
