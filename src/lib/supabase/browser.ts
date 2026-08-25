"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env/public";
import { requirePublicSupabase } from "@/lib/env/resolve";
import type { Database } from "@/types/database";

export function createBrowserSupabaseClient() {
  const { url, publishableKey } = requirePublicSupabase(getPublicEnv());
  return createBrowserClient<Database>(url, publishableKey);
}
