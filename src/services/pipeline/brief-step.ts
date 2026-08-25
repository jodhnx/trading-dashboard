import "server-only";

import { generateDailyBrief } from "@/services/daily-brief/generate";
import type { OpenAiClient } from "@/ai/types";
import type { PipelineUserBriefResult } from "./types";

export async function runPipelineBriefForUser(input: {
  userId: string;
  email: string | null;
  briefDate: string;
  client?: OpenAiClient | null;
  now?: Date;
}): Promise<PipelineUserBriefResult> {
  const result = await generateDailyBrief({
    userId: input.userId,
    email: input.email,
    date: input.briefDate,
    client: input.client,
    now: input.now,
  });

  if (result.ok) {
    return {
      userId: input.userId,
      created: true,
      alreadyExists: false,
    };
  }

  if (result.code === "BRIEF_EXISTS") {
    return {
      userId: input.userId,
      created: false,
      alreadyExists: true,
    };
  }

  return {
    userId: input.userId,
    created: false,
    alreadyExists: false,
    error: result.error,
  };
}
