import type { DataStatus } from "@/services/market/provider";

export type PipelineStatus = "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";

export type PipelineAssetResult = {
  symbol: string;
  quoteStatus: DataStatus | "UNAVAILABLE";
  technicalStatus: DataStatus | "UNAVAILABLE";
  error?: string;
};

export type PipelineUserBriefResult = {
  userId: string;
  created: boolean;
  alreadyExists: boolean;
  error?: string;
};

export type PipelineResult = {
  status: PipelineStatus;
  date: string;
  durationMs: number;
  assetsProcessed: number;
  market: {
    live: number;
    cached: number;
    stale: number;
    mock: number;
    unavailable: number;
    assets: PipelineAssetResult[];
  };
  news: {
    fetched: boolean;
    inserted: number;
    duplicates: number;
    error?: string;
  };
  technical: {
    processed: number;
    unavailable: number;
  };
  ai: {
    requested: number;
    completed: number;
    reused: number;
    skipped: number;
    unavailable: number;
  };
  opportunities: {
    scanned: number;
    topStocks: number;
    topCrypto: number;
    watch: number;
    persisted: number;
    noHighConfidence: boolean;
    marketRegime: string;
    boardState: string;
    liveOrCached: number;
    diagnosticsSample: Array<{
      symbol: string;
      dataStatus: string;
      setupDirection: string;
      finalScore: number;
      tier: string;
      rejectionReason: string | null;
    }>;
  };
  brief: {
    usersProcessed: number;
    created: number;
    alreadyExists: number;
    failed: number;
    users: PipelineUserBriefResult[];
  };
  lock?: {
    acquired: boolean;
    reason?: string;
  };
};
