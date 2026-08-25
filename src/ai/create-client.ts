import "server-only";

import { getSecretEnv } from "@/lib/env/server";
import { HttpOpenAiClient, resolveOpenAiModel } from "@/ai/client";
import type { OpenAiClient } from "@/ai/types";

export function createOpenAiClient(): OpenAiClient | null {
  const { openaiApiKey } = getSecretEnv();
  if (!openaiApiKey) {
    return null;
  }
  return new HttpOpenAiClient(openaiApiKey, resolveOpenAiModel());
}
