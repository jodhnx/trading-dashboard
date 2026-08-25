import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getRequiredAdminSupabase } from "@/lib/env/server";
import type { Database } from "@/types/database";

/**
 * Service / secret client. Bypasses RLS.
 * Never import this file from Client Components.
 */
export function createAdminSupabaseClient() {
  const { url, secretKey } = getRequiredAdminSupabase();

  return createClient<Database>(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
