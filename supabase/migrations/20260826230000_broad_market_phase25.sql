-- Phase 25: broad market symbol universe catalog

CREATE TABLE IF NOT EXISTS symbol_universe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL UNIQUE,
  provider_symbol text,
  name text NOT NULL,
  asset_type text NOT NULL CHECK (asset_type IN ('STOCK', 'ETF', 'CRYPTO', 'COMMODITY', 'INDEX')),
  exchange text,
  country text NOT NULL DEFAULT 'US',
  currency text NOT NULL DEFAULT 'USD',
  market_cap bigint,
  average_volume bigint,
  tradable boolean NOT NULL DEFAULT true,
  provider_mapped boolean NOT NULL DEFAULT false,
  liquidity_tier text NOT NULL DEFAULT 'MEDIUM' CHECK (liquidity_tier IN ('HIGH', 'MEDIUM', 'LOW')),
  is_leveraged_etf boolean NOT NULL DEFAULT false,
  is_high_risk boolean NOT NULL DEFAULT false,
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_symbol_universe_tradable ON symbol_universe (tradable, asset_type);
CREATE INDEX IF NOT EXISTS idx_symbol_universe_provider ON symbol_universe (provider_mapped) WHERE provider_mapped = true;

ALTER TABLE symbol_universe ENABLE ROW LEVEL SECURITY;

-- Read-only for authenticated users; writes via service role only
CREATE POLICY symbol_universe_select ON symbol_universe
  FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE symbol_universe IS 'Phase 25 broad market scan universe — normalized symbol catalog';
