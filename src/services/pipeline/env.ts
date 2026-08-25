import "server-only";

import { getRequiredAdminSupabase } from "@/lib/env/server";

export type PipelineEnvValidation = {
  ok: boolean;
  errors: string[];
};

export function validatePipelineEnvironment(): PipelineEnvValidation {
  const errors: string[] = [];

  try {
    getRequiredAdminSupabase();
  } catch {
    errors.push("SUPABASE admin configuration is required for the daily pipeline");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
