import "server-only";

import { createOpenAiClient } from "@/ai/create-client";
import type { OpenAiClient } from "@/ai/types";
import { assembleDailyBriefInput } from "./assemble";
import { applySummaryToSnapshot, summarizeDailyBrief } from "./summarize";
import { findBriefByDate, persistBrief } from "./persistence";
import {
  beginBriefRequest,
  briefRequestKey,
  endBriefRequest,
} from "./request-guard";
import { parseBriefDateParam, utcBriefDate } from "./date";
import { DAILY_BRIEF_PROMPT_VERSION } from "./types";
import type { BriefPersistence } from "./persistence";
import type { GenerateBriefResult } from "./types";

function logDailyBriefAssembleFailure(input: {
  userId: string;
  briefDate: string;
  error: unknown;
}): void {
  const message =
    input.error instanceof Error ? input.error.message : "unknown_error";
  console.error("[daily-brief] assemble failed", {
    userId: input.userId,
    briefDate: input.briefDate,
    reason: message.slice(0, 200),
  });
}

function logDailyBriefPersistFailure(input: {
  userId: string;
  briefDate: string;
}): void {
  console.error("[daily-brief] persist failed", {
    userId: input.userId,
    briefDate: input.briefDate,
  });
}

export async function generateDailyBrief(input: {
  userId: string;
  email: string | null;
  date?: string | null;
  client?: OpenAiClient | null;
  now?: Date;
  persistence?: BriefPersistence;
}): Promise<GenerateBriefResult> {
  const now = input.now ?? new Date();
  const parsed = parseBriefDateParam(input.date, now);
  if (!parsed.ok) {
    return { ok: false, code: "INVALID_DATE", error: parsed.error };
  }

  const key = briefRequestKey(input.userId, parsed.date);
  if (!beginBriefRequest(key)) {
    return {
      ok: false,
      code: "REQUEST_IN_PROGRESS",
      error: "A Daily Brief for this date is already generating",
    };
  }

  try {
    const existing = await findBriefByDate({
      userId: input.userId,
      briefDate: parsed.date,
      now,
      persistence: input.persistence,
    });
    if (existing) {
      return {
        ok: false,
        code: "BRIEF_EXISTS",
        error: `Daily Brief already exists for ${parsed.date}`,
      };
    }

    if (input.client?.isMock && process.env.NODE_ENV === "production") {
      return {
        ok: false,
        code: "AI_UNAVAILABLE",
        error: "Mock AI is not allowed in production",
      };
    }

    let assembled;
    try {
      assembled = await assembleDailyBriefInput({
        userId: input.userId,
        email: input.email,
        briefDate: parsed.date,
        now,
        persistence: input.persistence,
      });
    } catch (error) {
      logDailyBriefAssembleFailure({
        userId: input.userId,
        briefDate: parsed.date,
        error,
      });
      return {
        ok: false,
        code: "DATA_UNAVAILABLE",
        error: "Failed to assemble market or settings data",
      };
    }

    const client =
      input.client === undefined ? createOpenAiClient() : input.client;
    const summarized = await summarizeDailyBrief({
      assembled,
      client,
    });

    const snapshot = applySummaryToSnapshot(assembled.snapshot, summarized);
    const stored = await persistBrief({
      userId: input.userId,
      briefDate: parsed.date,
      marketRegime: summarized.marketRegime,
      riskEnvironment: summarized.riskEnvironment,
      summary: summarized.summary,
      finalStatus: assembled.finalStatus,
      snapshot,
      model: summarized.model,
      promptVersion: summarized.promptVersion || DAILY_BRIEF_PROMPT_VERSION,
      aiStatus: summarized.aiStatus,
      isMock: client?.isMock ?? false,
      generatedAt: snapshot.generatedAt,
      persistence: input.persistence,
    });

    if (!stored) {
      logDailyBriefPersistFailure({
        userId: input.userId,
        briefDate: parsed.date,
      });
      return {
        ok: false,
        code: "PERSISTENCE_FAILED",
        error: "Failed to store Daily Brief",
      };
    }

    return { ok: true, brief: stored };
  } finally {
    endBriefRequest(key);
  }
}

export function defaultBriefDate(now: Date = new Date()): string {
  return utcBriefDate(now);
}
