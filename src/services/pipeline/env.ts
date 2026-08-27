import "server-only";

import { EnvValidationError } from "@/lib/env/errors";
import { getRequiredAdminSupabase } from "@/lib/env/server";
import { resolveMarketProvider, resolveNewsProvider } from "@/lib/env/resolve";

export type PipelineEnvValidation = {
  ok: boolean;
  errors: string[];
};

function pipelineRawEnv() {
  return {
    MARKET_DATA_PROVIDER: process.env.MARKET_DATA_PROVIDER,
    TWELVE_DATA_API_KEY: process.env.TWELVE_DATA_API_KEY,
    NEWS_PROVIDER: process.env.NEWS_PROVIDER,
    NEWS_API_KEY: process.env.NEWS_API_KEY,
    NEWSAPI_API_KEY: process.env.NEWSAPI_API_KEY,
    NEWSAPI_KEY: process.env.NEWSAPI_KEY,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
  };
}

export function validatePipelineEnvironment(): PipelineEnvValidation {
  const errors: string[] = [];

  try {
    getRequiredAdminSupabase();
  } catch {
    errors.push("SUPABASE admin configuration is required for the daily pipeline");
  }

  try {
    const market = resolveMarketProvider(pipelineRawEnv());
    if (market.providerId === "unavailable") {
      errors.push(`Market data unavailable: ${market.reason}`);
    } else if (market.isMock) {
      errors.push(`Market data mock provider not allowed in pipeline: ${market.reason}`);
    }
  } catch (error) {
    errors.push(
      error instanceof EnvValidationError
        ? error.message
        : "Market data provider configuration is invalid",
    );
  }

  try {
    const news = resolveNewsProvider(pipelineRawEnv());
    if (news.providerId === "unavailable") {
      errors.push(`News provider unavailable: ${news.reason}`);
    } else if (news.isMock) {
      errors.push(`News mock provider not allowed in pipeline: ${news.reason}`);
    }
  } catch (error) {
    errors.push(
      error instanceof EnvValidationError
        ? error.message
        : "News provider configuration is invalid",
    );
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
