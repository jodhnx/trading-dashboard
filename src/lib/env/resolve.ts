import { EnvValidationError } from "./errors";

export type RawEnv = Record<string, string | undefined>;

export type PublicEnv = {
  supabaseUrl: string | null;
  supabasePublishableKey: string | null;
  supabaseConfigured: boolean;
};

export type SecretEnv = {
  supabaseSecretKey: string | null;
  openaiApiKey: string | null;
  twelveDataApiKey: string | null;
  newsApiKey: string | null;
};

export type NewsProviderId = "newsapi" | "mock" | "unavailable";

export type NewsProviderResolution = {
  providerId: NewsProviderId;
  isMock: boolean;
  reason: string;
};

export type MarketProviderId = "twelve-data" | "mock" | "unavailable";

export type MarketProviderResolution = {
  providerId: MarketProviderId;
  isMock: boolean;
  reason: string;
};

/** Production when NODE_ENV or VERCEL_ENV is production (unset NODE_ENV alone is not dev). */
export function isProductionEnv(env: RawEnv): boolean {
  const nodeEnv = (env.NODE_ENV ?? process.env.NODE_ENV ?? "")
    .trim()
    .toLowerCase();
  if (nodeEnv === "production") return true;
  const vercelEnv = (env.VERCEL_ENV ?? process.env.VERCEL_ENV ?? "")
    .trim()
    .toLowerCase();
  return vercelEnv === "production";
}

function firstNonEmpty(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
}

export function resolvePublicEnv(env: RawEnv): PublicEnv {
  const supabaseUrl = firstNonEmpty(
    env.SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const supabasePublishableKey = firstNonEmpty(
    env.SUPABASE_PUBLISHABLE_KEY,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return {
    supabaseUrl,
    supabasePublishableKey,
    supabaseConfigured: Boolean(supabaseUrl && supabasePublishableKey),
  };
}

export function resolveSecretEnv(env: RawEnv): SecretEnv {
  return {
    supabaseSecretKey: firstNonEmpty(
      env.SUPABASE_SECRET_KEY,
      env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    openaiApiKey: firstNonEmpty(env.OPENAI_API_KEY),
    twelveDataApiKey: firstNonEmpty(env.TWELVE_DATA_API_KEY),
    newsApiKey: firstNonEmpty(
      env.NEWS_API_KEY,
      env.NEWSAPI_API_KEY,
      env.NEWSAPI_KEY,
    ),
  };
}

export function resolveMarketProvider(env: RawEnv): MarketProviderResolution {
  const requested = (env.MARKET_DATA_PROVIDER ?? "auto").trim().toLowerCase();
  const hasTwelveDataKey = Boolean(firstNonEmpty(env.TWELVE_DATA_API_KEY));

  if (requested === "mock") {
    if (isProductionEnv(env)) {
      throw new EnvValidationError(
        "MARKET_DATA_PROVIDER=mock is not allowed in production. Use twelve-data or auto.",
      );
    }
    return {
      providerId: "mock",
      isMock: true,
      reason: "MARKET_DATA_PROVIDER=mock",
    };
  }

  if (requested === "twelve-data") {
    if (!hasTwelveDataKey) {
      throw new EnvValidationError(
        "TWELVE_DATA_API_KEY is required when MARKET_DATA_PROVIDER=twelve-data.",
      );
    }
    return {
      providerId: "twelve-data",
      isMock: false,
      reason: "MARKET_DATA_PROVIDER=twelve-data",
    };
  }

  if (requested !== "auto") {
    throw new EnvValidationError(
      `Invalid MARKET_DATA_PROVIDER "${requested}". Use auto, twelve-data, or mock.`,
    );
  }

  if (hasTwelveDataKey) {
    return {
      providerId: "twelve-data",
      isMock: false,
      reason: "auto: TWELVE_DATA_API_KEY is set",
    };
  }

  if (isProductionEnv(env)) {
    return {
      providerId: "unavailable",
      isMock: false,
      reason: "auto: TWELVE_DATA_API_KEY is missing in production",
    };
  }

  return {
    providerId: "mock",
    isMock: true,
    reason: "auto: TWELVE_DATA_API_KEY is missing, using mock provider",
  };
}

export function resolveNewsProvider(env: RawEnv): NewsProviderResolution {
  const requested = (env.NEWS_PROVIDER ?? "auto").trim().toLowerCase();
  const hasNewsApiKey = Boolean(
    firstNonEmpty(env.NEWS_API_KEY, env.NEWSAPI_API_KEY, env.NEWSAPI_KEY),
  );

  if (requested === "mock") {
    if (isProductionEnv(env)) {
      throw new EnvValidationError(
        "NEWS_PROVIDER=mock is not allowed in production. Use newsapi or auto.",
      );
    }
    return {
      providerId: "mock",
      isMock: true,
      reason: "NEWS_PROVIDER=mock",
    };
  }

  if (requested === "newsapi") {
    if (!hasNewsApiKey) {
      throw new EnvValidationError(
        "NEWS_API_KEY is required when NEWS_PROVIDER=newsapi.",
      );
    }
    return {
      providerId: "newsapi",
      isMock: false,
      reason: "NEWS_PROVIDER=newsapi",
    };
  }

  if (requested !== "auto") {
    throw new EnvValidationError(
      `Invalid NEWS_PROVIDER "${requested}". Use auto, newsapi, or mock.`,
    );
  }

  if (hasNewsApiKey) {
    return {
      providerId: "newsapi",
      isMock: false,
      reason: "auto: NEWS_API_KEY is set",
    };
  }

  if (isProductionEnv(env)) {
    return {
      providerId: "unavailable",
      isMock: false,
      reason: "auto: NEWS_API_KEY is missing in production",
    };
  }

  return {
    providerId: "mock",
    isMock: true,
    reason: "auto: NEWS_API_KEY is missing, using mock provider",
  };
}

export function requirePublicSupabase(env: PublicEnv): {
  url: string;
  publishableKey: string;
} {
  if (!env.supabaseUrl || !env.supabasePublishableKey) {
    throw new EnvValidationError(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env.local.",
    );
  }
  return { url: env.supabaseUrl, publishableKey: env.supabasePublishableKey };
}

export function requireSecretSupabase(
  publicEnv: PublicEnv,
  secretEnv: SecretEnv,
): { url: string; secretKey: string } {
  const { url } = requirePublicSupabase(publicEnv);
  if (!secretEnv.supabaseSecretKey) {
    throw new EnvValidationError(
      "SUPABASE_SECRET_KEY is required for server admin operations.",
    );
  }
  return { url, secretKey: secretEnv.supabaseSecretKey };
}

export function publicEnvKeys(env: PublicEnv): string[] {
  return Object.keys(env);
}
