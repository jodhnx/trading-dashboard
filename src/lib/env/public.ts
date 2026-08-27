import {
  resolvePublicEnv,
  resolveMarketProvider,
  resolveNewsProvider,
  type PublicEnv,
} from "./resolve";

export function getPublicEnv(): PublicEnv {
  return resolvePublicEnv({
    SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export function getMarketProviderInfo() {
  return resolveMarketProvider({
    MARKET_DATA_PROVIDER: process.env.MARKET_DATA_PROVIDER,
    TWELVE_DATA_API_KEY: process.env.TWELVE_DATA_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });
}

export function getNewsProviderInfo() {
  return resolveNewsProvider({
    NEWS_PROVIDER: process.env.NEWS_PROVIDER,
    NEWS_API_KEY: process.env.NEWS_API_KEY,
    NEWSAPI_API_KEY: process.env.NEWSAPI_API_KEY,
    NEWSAPI_KEY: process.env.NEWSAPI_KEY,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });
}
