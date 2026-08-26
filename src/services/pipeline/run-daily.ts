import "server-only";

import { createOpenAiClient } from "@/ai/create-client";
import { OPPORTUNITY_UNIVERSE } from "@/services/opportunity/universe";
import { defaultPipelineBriefDate, acquirePipelineLock, releasePipelineLock } from "./lock";
import { validatePipelineEnvironment } from "./env";
import { warmMarketData } from "./market-step";
import { ingestLatestNews } from "./news-step";
import { runPipelineAiForUser } from "./ai-step";
import { runPipelineBriefForUser } from "./brief-step";
import { runOpportunityScanForUser } from "./opportunity-step";
import { listActiveUsers } from "./users";
import type { PipelineResult, PipelineStatus } from "./types";

export async function runDailyPipeline(input?: {
  briefDate?: string;
  now?: Date;
}): Promise<PipelineResult> {
  const started = Date.now();
  const now = input?.now ?? new Date();
  const briefDate = input?.briefDate ?? defaultPipelineBriefDate(now);

  const env = validatePipelineEnvironment();
  if (!env.ok) {
    return failedResult({
      briefDate,
      started,
      reason: env.errors.join("; "),
    });
  }

  const lock = await acquirePipelineLock({ briefDate, now });
  if (!lock.acquired) {
    return {
      status: "SKIPPED",
      date: briefDate,
      durationMs: Date.now() - started,
      assetsProcessed: 0,
      market: emptyMarket(),
      news: { fetched: false, inserted: 0, duplicates: 0 },
      technical: { processed: 0, unavailable: 0 },
      ai: emptyAi(),
      opportunities: emptyOpportunities(),
      brief: emptyBrief(),
      lock: { acquired: false, reason: lock.reason },
    };
  }

  const aiTotals = emptyAi();
  const briefUsers: PipelineResult["brief"]["users"] = [];
  let opportunityTotals = emptyOpportunities();
  let newsResult: PipelineResult["news"] = {
    fetched: false,
    inserted: 0,
    duplicates: 0,
  };
  let marketResult = emptyMarket();

  try {
    const warmed = await warmMarketData();
    marketResult = {
      ...warmed.counts,
      assets: warmed.assets,
    };
    newsResult = await ingestLatestNews();

    const users = await listActiveUsers();
    const client = createOpenAiClient();

    for (const user of users) {
      try {
        const opp = await runOpportunityScanForUser({
          userId: user.id,
          email: user.email,
          briefDate,
          now,
        });
        opportunityTotals = {
          scanned: opp.summary.scanned,
          topStocks: opp.summary.topStocks.length,
          topCrypto: opp.summary.topCrypto.length,
          watch: opp.summary.watch,
          persisted: opportunityTotals.persisted + opp.persisted.inserted,
          noHighConfidence: opp.summary.noHighConfidence,
          marketRegime: opp.summary.marketRegime,
          boardState: opp.summary.boardState,
          liveOrCached: opp.summary.liveOrCached,
          diagnosticsSample: opp.summary.diagnostics
            .filter(
              (d) =>
                d.technicalStatus === "LIVE" ||
                d.technicalStatus === "CACHED" ||
                d.technicalStatus === "STALE" ||
                d.tier === "DATA_SKIP",
            )
            .slice(0, 12)
            .map((d) => ({
              symbol: d.symbol,
              dataStatus: d.technicalStatus,
              setupDirection: d.engineDirection,
              finalScore: d.finalOpportunityScore,
              tier: d.tier,
              rejectionReason: d.rejectionReason,
            })),
        };
      } catch (error) {
        console.error("[pipeline] opportunity scan failed", {
          userId: user.id,
          reason:
            error instanceof Error ? error.message.slice(0, 200) : "unknown",
        });
      }

      const ai = await runPipelineAiForUser({
        userId: user.id,
        email: user.email,
        client,
        now,
      });
      aiTotals.requested += ai.requested;
      aiTotals.completed += ai.completed;
      aiTotals.reused += ai.reused;
      aiTotals.skipped += ai.skipped;
      aiTotals.unavailable += ai.unavailable;

      const brief = await runPipelineBriefForUser({
        userId: user.id,
        email: user.email,
        briefDate,
        client,
        now,
      });
      briefUsers.push(brief);
    }

    const technicalUnavailable = marketResult.assets.filter(
      (asset) => asset.technicalStatus === "UNAVAILABLE",
    ).length;
    const technicalProcessed = OPPORTUNITY_UNIVERSE.length - technicalUnavailable;

    const briefCreated = briefUsers.filter((item) => item.created).length;
    const briefExists = briefUsers.filter((item) => item.alreadyExists).length;
    const briefFailed = briefUsers.filter(
      (item) => !item.created && !item.alreadyExists,
    ).length;

    const status = derivePipelineStatus({
      marketUnavailable: warmed.counts.unavailable,
      newsFetched: newsResult.fetched,
      users: users.length,
      briefCreated,
      briefExists,
      briefFailed,
    });

    const result: PipelineResult = {
      status,
      date: briefDate,
      durationMs: Date.now() - started,
      assetsProcessed: OPPORTUNITY_UNIVERSE.length,
      market: {
        live: marketResult.live,
        cached: marketResult.cached,
        stale: marketResult.stale,
        mock: marketResult.mock,
        unavailable: marketResult.unavailable,
        assets: marketResult.assets,
      },
      news: {
        fetched: newsResult.fetched,
        inserted: newsResult.inserted,
        duplicates: newsResult.duplicates,
        error: newsResult.error,
      },
      technical: {
        processed: technicalProcessed,
        unavailable: technicalUnavailable,
      },
      ai: aiTotals,
      opportunities: opportunityTotals,
      brief: {
        usersProcessed: users.length,
        created: briefCreated,
        alreadyExists: briefExists,
        failed: briefFailed,
        users: briefUsers,
      },
      lock: { acquired: true },
    };

    await releasePipelineLock({
      runId: lock.runId,
      briefDate,
      status: status === "SKIPPED" ? "SKIPPED" : status,
      summary: sanitizeSummary(result),
      assetsProcessed: result.assetsProcessed,
      aiRequests: aiTotals.requested,
      newsInserted: newsResult.inserted,
      now,
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "pipeline_error";
    await releasePipelineLock({
      runId: lock.runId,
      briefDate,
      status: "FAILED",
      summary: { error: message },
      errorSummary: { message },
      now,
    });
    return failedResult({ briefDate, started, reason: message, lockAcquired: true });
  }
}

function derivePipelineStatus(input: {
  marketUnavailable: number;
  newsFetched: boolean;
  users: number;
  briefCreated: number;
  briefExists: number;
  briefFailed: number;
}): PipelineStatus {
  if (input.users === 0) {
    if (!input.newsFetched || input.marketUnavailable > 0) {
      return "PARTIAL";
    }
    return "SUCCESS";
  }

  const usableBriefs = input.briefCreated + input.briefExists;
  if (usableBriefs === 0 && input.briefFailed > 0) {
    return "FAILED";
  }
  if (
    input.marketUnavailable > 0 ||
    !input.newsFetched ||
    input.briefFailed > 0
  ) {
    return "PARTIAL";
  }
  return "SUCCESS";
}

function emptyMarket(): PipelineResult["market"] {
  return {
    live: 0,
    cached: 0,
    stale: 0,
    mock: 0,
    unavailable: 0,
    assets: [],
  };
}

function emptyAi(): PipelineResult["ai"] {
  return {
    requested: 0,
    completed: 0,
    reused: 0,
    skipped: 0,
    unavailable: 0,
  };
}

function emptyOpportunities(): PipelineResult["opportunities"] {
  return {
    scanned: 0,
    topStocks: 0,
    topCrypto: 0,
    watch: 0,
    persisted: 0,
    noHighConfidence: true,
    marketRegime: "UNKNOWN",
    boardState: "DATA_INSUFFICIENT",
    liveOrCached: 0,
    diagnosticsSample: [],
  };
}

function emptyBrief(): PipelineResult["brief"] {
  return {
    usersProcessed: 0,
    created: 0,
    alreadyExists: 0,
    failed: 0,
    users: [],
  };
}

function failedResult(input: {
  briefDate: string;
  started: number;
  reason: string;
  lockAcquired?: boolean;
}): PipelineResult {
  return {
    status: "FAILED",
    date: input.briefDate,
    durationMs: Date.now() - input.started,
    assetsProcessed: 0,
    market: emptyMarket(),
    news: { fetched: false, inserted: 0, duplicates: 0, error: input.reason },
    technical: { processed: 0, unavailable: 0 },
    ai: emptyAi(),
    opportunities: emptyOpportunities(),
    brief: emptyBrief(),
    lock: input.lockAcquired ? { acquired: true } : { acquired: false, reason: input.reason },
  };
}

function sanitizeSummary(result: PipelineResult): Record<string, unknown> {
  return {
    status: result.status,
    date: result.date,
    durationMs: result.durationMs,
    assetsProcessed: result.assetsProcessed,
    market: {
      live: result.market.live,
      cached: result.market.cached,
      stale: result.market.stale,
      mock: result.market.mock,
      unavailable: result.market.unavailable,
    },
    news: result.news,
    technical: result.technical,
    ai: result.ai,
    opportunities: result.opportunities,
    brief: {
      usersProcessed: result.brief.usersProcessed,
      created: result.brief.created,
      alreadyExists: result.brief.alreadyExists,
      failed: result.brief.failed,
    },
  };
}
