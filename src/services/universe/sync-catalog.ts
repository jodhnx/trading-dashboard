import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { normalizeInternalSymbol } from "@/services/market/symbols";
import { listTradableCatalog } from "./catalog";

/**
 * Upsert Phase 25 catalog symbols into shared reference tables.
 * Safe to run every pipeline — never deletes existing rows.
 */
export async function syncCatalogToDatabase(): Promise<{
  assetsUpserted: number;
  universeUpserted: number;
  errors: string[];
}> {
  const admin = createAdminSupabaseClient();
  const catalog = listTradableCatalog();
  let assetsUpserted = 0;
  let universeUpserted = 0;
  const errors: string[] = [];

  for (const item of catalog) {
    const symbol = normalizeInternalSymbol(item.symbol);
    const exchange = item.exchange ?? "UNKNOWN";

    const assetRow = {
      symbol,
      name: item.name,
      asset_type: item.assetType,
      exchange,
      currency: item.currency,
      provider_symbol: item.providerSymbol,
      is_active: item.tradable,
    };

    const assetResult = await admin
      .from("assets")
      .upsert(assetRow, { onConflict: "symbol" })
      .select("id")
      .maybeSingle();

    if (assetResult.error) {
      errors.push(`assets:${symbol}: ${assetResult.error.message}`);
      continue;
    }
    assetsUpserted += 1;

    const universeRow = {
      symbol,
      provider_symbol: item.providerSymbol,
      name: item.name,
      asset_type: item.assetType,
      exchange: item.exchange ?? null,
      country: item.country ?? "US",
      currency: item.currency,
      tradable: item.tradable,
      provider_mapped: item.providerMapped,
      liquidity_tier: item.liquidityTier,
      is_leveraged_etf: item.isLeveragedEtf ?? false,
      is_high_risk: item.isHighRisk ?? false,
      catalog_category: item.category ?? null,
      sector: item.sector ?? null,
      industry: item.industry ?? null,
      market: item.market ?? null,
      risk_hints: item.riskHints ?? [],
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const universeResult = await admin
      .from("symbol_universe")
      .upsert(universeRow, { onConflict: "symbol" });

    if (universeResult.error) {
      errors.push(`symbol_universe:${symbol}: ${universeResult.error.message}`);
    } else {
      universeUpserted += 1;
    }
  }

  return { assetsUpserted, universeUpserted, errors };
}
