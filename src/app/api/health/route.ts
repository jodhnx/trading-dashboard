import { getMarketProviderInfo, getNewsProviderInfo, getPublicEnv } from "@/lib/env/public";
import { EnvValidationError } from "@/lib/env/errors";
import { isCronConfigured } from "@/services/pipeline/auth";

function providerHealth(
  resolve: () => { providerId: string; isMock: boolean },
): { provider: string; isMock: boolean; configured: boolean } {
  try {
    const info = resolve();
    return {
      provider: info.providerId,
      isMock: info.isMock,
      configured: info.providerId !== "unavailable",
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

  return Response.json({
    ok: true,
    phase: 22,
    supabase: {
      configured: publicEnv.supabaseConfigured,
    },
    marketData: market,
    news: news,
    openai: {
      configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      modelConfigured: Boolean(process.env.OPENAI_MODEL?.trim()),
    },
    cron: {
      configured: isCronConfigured(),
      scheduleUtc: "30 5 * * *",
      path: "/api/cron/daily-pipeline",
      note: "Hobby one-cron-per-day covers the daily opportunity scan only. Real-time exit monitoring requires an external/hourly scheduler.",
    },
  });
}
