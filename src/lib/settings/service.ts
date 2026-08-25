import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { ProfileRow, UserSettingsRow } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  BASE_CURRENCIES,
  USER_SETTINGS_DEFAULTS,
  type BaseCurrency,
} from "@/types/settings";
import { TRADING_STYLES, type TradingStyle } from "@/types/enums";
import {
  coerceFiniteNumber,
  fractionToPercent,
  type AccountSettings,
  type SettingsRecord,
} from "./schema";
import { PREFERRED_MARKET_OPTIONS, type PreferredMarket } from "@/types/settings";

export type SettingsPersistence = "session" | "admin";

async function resolveSupabase(
  mode: SettingsPersistence,
): Promise<SupabaseClient<Database>> {
  return mode === "admin"
    ? createAdminSupabaseClient()
    : await createServerSupabaseClient();
}

function asBaseCurrency(value: string): BaseCurrency {
  return (BASE_CURRENCIES as readonly string[]).includes(value)
    ? (value as BaseCurrency)
    : USER_SETTINGS_DEFAULTS.baseCurrency;
}

function asTradingStyle(value: string): TradingStyle {
  return (TRADING_STYLES as readonly string[]).includes(value)
    ? (value as TradingStyle)
    : USER_SETTINGS_DEFAULTS.tradingStyle;
}

function asPreferredMarkets(value: string[]): PreferredMarket[] {
  const allowed = new Set<string>(PREFERRED_MARKET_OPTIONS);
  const selected = value.filter((item): item is PreferredMarket =>
    allowed.has(item),
  );
  return selected.length > 0
    ? selected
    : [...USER_SETTINGS_DEFAULTS.preferredMarkets];
}

export function toAccountSettings(
  profile: ProfileRow,
  settings: UserSettingsRow,
  email: string | null,
): AccountSettings {
  return {
    email,
    displayName:
      profile.display_name?.trim() ||
      email?.split("@")[0] ||
      "Trader",
    baseCurrency: asBaseCurrency(profile.base_currency),
    capital: coerceFiniteNumber(settings.capital, USER_SETTINGS_DEFAULTS.capital),
    riskPerTradePercent: fractionToPercent(
      coerceFiniteNumber(settings.risk_per_trade, USER_SETTINGS_DEFAULTS.riskPerTrade),
    ),
    maxDailyRiskPercent: fractionToPercent(
      coerceFiniteNumber(settings.max_daily_risk, USER_SETTINGS_DEFAULTS.maxDailyRisk),
    ),
    maxPositionPercent: fractionToPercent(
      coerceFiniteNumber(
        settings.max_portfolio_exposure,
        USER_SETTINGS_DEFAULTS.maxPortfolioExposure,
      ),
    ),
    minimumRiskReward: coerceFiniteNumber(
      settings.minimum_risk_reward,
      USER_SETTINGS_DEFAULTS.minimumRiskReward,
    ),
    minimumAiScore: coerceFiniteNumber(
      settings.minimum_ai_score,
      USER_SETTINGS_DEFAULTS.minimumAiScore,
    ),
    maxOpenPositions: Math.round(
      coerceFiniteNumber(
        settings.max_open_positions,
        USER_SETTINGS_DEFAULTS.maxOpenPositions,
      ),
    ),
    tradingStyle: asTradingStyle(settings.trading_style),
    preferredMarkets: asPreferredMarkets(settings.preferred_markets ?? []),
    preferredAssets: settings.preferred_assets ?? [],
  };
}

export async function getOrCreateAccountSettings(
  userId: string,
  email: string | null,
  options?: { persistence?: SettingsPersistence },
): Promise<AccountSettings> {
  const supabase = await resolveSupabase(options?.persistence ?? "session");

  let profile = (
    await supabase.from("profiles").select("*").eq("id", userId).maybeSingle()
  ).data;

  if (!profile) {
    const displayName = email?.split("@")[0] ?? "Trader";
    const inserted = await supabase
      .from("profiles")
      .insert({
        id: userId,
        display_name: displayName,
        base_currency: USER_SETTINGS_DEFAULTS.baseCurrency,
      })
      .select("*")
      .single();

    if (inserted.error || !inserted.data) {
      throw new Error("Could not create profile.");
    }
    profile = inserted.data;
  }

  let settings = (
    await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
  ).data;

  if (!settings) {
    const inserted = await supabase
      .from("user_settings")
      .insert({ user_id: userId })
      .select("*")
      .single();

    if (inserted.error || !inserted.data) {
      throw new Error("Could not create user settings.");
    }
    settings = inserted.data;
  }

  return toAccountSettings(profile, settings, email);
}

export async function updateAccountSettings(
  userId: string,
  record: SettingsRecord,
): Promise<void> {
  const supabase = await createServerSupabaseClient();

  const profileUpdate = await supabase
    .from("profiles")
    .update({
      display_name: record.displayName,
      base_currency: record.baseCurrency,
    })
    .eq("id", userId);

  if (profileUpdate.error) {
    throw new Error("Could not save profile.");
  }

  const settingsUpdate = await supabase
    .from("user_settings")
    .update({
      capital: record.capital,
      risk_per_trade: record.riskPerTrade,
      max_daily_risk: record.maxDailyRisk,
      max_portfolio_exposure: record.maxPortfolioExposure,
      minimum_risk_reward: record.minimumRiskReward,
      minimum_ai_score: record.minimumAiScore,
      max_open_positions: record.maxOpenPositions,
      trading_style: record.tradingStyle,
      preferred_markets: [...record.preferredMarkets],
      preferred_assets: record.preferredAssets,
    })
    .eq("user_id", userId);

  if (settingsUpdate.error) {
    throw new Error("Could not save settings.");
  }
}
