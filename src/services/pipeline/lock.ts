import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { utcBriefDate } from "@/services/daily-brief/date";
import type { Json } from "@/types/database";

const STALE_LOCK_MS = 45 * 60_000;

export type PipelineLockResult =
  | { acquired: true; runId: string }
  | { acquired: false; reason: string };

export async function acquirePipelineLock(input: {
  briefDate: string;
  now?: Date;
}): Promise<PipelineLockResult> {
  const now = input.now ?? new Date();
  const runKey = `daily:${input.briefDate}`;
  const admin = createAdminSupabaseClient();

  const existing = await admin
    .from("pipeline_runs")
    .select("id, status, started_at")
    .eq("run_key", runKey)
    .maybeSingle();

  if (existing.data?.status === "RUNNING") {
    const startedMs = Date.parse(existing.data.started_at);
    if (
      Number.isFinite(startedMs) &&
      now.getTime() - startedMs < STALE_LOCK_MS
    ) {
      return { acquired: false, reason: "Pipeline already running" };
    }
    await admin
      .from("pipeline_runs")
      .update({
        status: "FAILED",
        finished_at: now.toISOString(),
        error_summary: { reason: "stale_running_lock_replaced" },
      })
      .eq("id", existing.data.id);
  }

  const inserted = await admin
    .from("pipeline_runs")
    .upsert(
      {
        run_key: runKey,
        brief_date: input.briefDate,
        status: "RUNNING",
        started_at: now.toISOString(),
        finished_at: null,
        assets_processed: 0,
        ai_requests: 0,
        news_inserted: 0,
        error_summary: {},
        result_summary: {},
      },
      { onConflict: "run_key" },
    )
    .select("id")
    .single();

  if (inserted.error || !inserted.data) {
    return { acquired: false, reason: "Could not acquire pipeline lock" };
  }

  return { acquired: true, runId: inserted.data.id };
}

export async function releasePipelineLock(input: {
  runId: string;
  briefDate: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";
  summary: Record<string, unknown>;
  assetsProcessed?: number;
  aiRequests?: number;
  newsInserted?: number;
  errorSummary?: Record<string, unknown>;
  now?: Date;
}): Promise<void> {
  const admin = createAdminSupabaseClient();
  await admin
    .from("pipeline_runs")
    .update({
      status: input.status,
      finished_at: (input.now ?? new Date()).toISOString(),
      assets_processed: input.assetsProcessed ?? null,
      ai_requests: input.aiRequests ?? null,
      news_inserted: input.newsInserted ?? null,
      result_summary: input.summary as Json,
      error_summary: (input.errorSummary ?? {}) as Json,
    })
    .eq("id", input.runId);
}

export function defaultPipelineBriefDate(now: Date = new Date()): string {
  return utcBriefDate(now);
}
