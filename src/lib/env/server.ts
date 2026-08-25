import "server-only";

import { getPublicEnv } from "./public";
import {
  requirePublicSupabase,
  requireSecretSupabase,
  resolveSecretEnv,
  type SecretEnv,
} from "./resolve";

export function getSecretEnv(): SecretEnv {
  return resolveSecretEnv({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    TWELVE_DATA_API_KEY: process.env.TWELVE_DATA_API_KEY,
    NEWS_API_KEY: process.env.NEWS_API_KEY,
    NEWSAPI_API_KEY: process.env.NEWSAPI_API_KEY,
    NEWSAPI_KEY: process.env.NEWSAPI_KEY,
  });
}

export function getRequiredPublicSupabase() {
  return requirePublicSupabase(getPublicEnv());
}

export function getRequiredAdminSupabase() {
  return requireSecretSupabase(getPublicEnv(), getSecretEnv());
}
