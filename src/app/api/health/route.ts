import { getMarketProviderInfo, getNewsProviderInfo, getPublicEnv } from "@/lib/env/public";
import { EnvValidationError } from "@/lib/env/errors";
import { isCronConfigured } from "@/services/pipeline/auth";
import {
  APP_VERSION,
  RELEASE_NAME,
  RELEASE_PHASE,
  RELEASE_NOTES,
} from "@/lib/release";

function providerHealth(
  resolve: () => { providerId: string; isMock: boolean },
): { provider: string; isMock: boolean; configured: boolean } {
  try {
    const info = resolve();
    return {
      provider: info.providerId,
      isMock: info.isMock,
      configured: info.providerId !== "unavailable" && !info.isMock,
    };
  } catch (error) {
    if (!(error instanceof EnvValidationError)) {
      throw error;
    }
    return {
      provider: "unconfigured",
      isMock: false,
      configured: false,
    };
  }
}

export async function GET() {
  const publicEnv = getPublicEnv();
  const market = providerHealth(() => getMarketProviderInfo());
  const news = providerHealth(() => getNewsProviderInfo());
  const cronConfigured = isCronConfigured();
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());

  const ok =
    publicEnv.supabaseConfigured &&
    market.configured &&
    news.configured &&
    cronConfigured &&
    openaiConfigured;

  return Response.json({
    ok,
    phase: RELEASE_PHASE,
    version: APP_VERSION,
    release: RELEASE_NAME,
    note: RELEASE_NOTES,
    supabase: {
      configured: publicEnv.supabaseConfigured,
    },
    marketData: market,
    news: news,
    openai: {
      configured: openaiConfigured,
      modelConfigured: Boolean(process.env.OPENAI_MODEL?.trim()),
    },
    cron: {
      configured: cronConfigured,
      scheduleUtc: "30 5 * * *",
      path: "/api/cron/daily-pipeline",
      note: "Hobby one-cron-per-day covers the daily opportunity scan only. Real-time exit monitoring requires an external/hourly scheduler.",
    },
  });
}
