import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { EnvValidationError } from "@/lib/env/errors";
import { NEWS_CATEGORIES, IMPACT_LEVELS, SENTIMENTS, RESEARCH_STATUSES } from "@/types/enums";
import type { ImpactLevel, NewsCategory, ResearchStatus, Sentiment } from "@/types/enums";
import { newsSummarySchema, AI_SUMMARY_UNAVAILABLE } from "@/ai/schemas/news-summary";
import { RELEVANCE_SCORE, relevanceFromScore } from "@/services/news/classify";
import { normalizeInternalSymbol } from "@/services/market/symbols";
import type { ResearchItem, ResearchListFilters, ResearchPersistence } from "./types";

async function getAdmin() {
  try {
    return createAdminSupabaseClient();
  } catch (error) {
    if (error instanceof EnvValidationError) {
      return null;
    }
    throw error;
  }
}

function isNewsCategory(value: unknown): value is NewsCategory {
  return (NEWS_CATEGORIES as readonly string[]).includes(String(value));
}

function isImpact(value: unknown): value is ImpactLevel {
  return (IMPACT_LEVELS as readonly string[]).includes(String(value));
}

function isSentiment(value: unknown): value is Sentiment {
  return (SENTIMENTS as readonly string[]).includes(String(value));
}

function isStatus(value: unknown): value is ResearchStatus {
  return (RESEARCH_STATUSES as readonly string[]).includes(String(value));
}

function parseAi(raw: string | null): ResearchItem["aiSummary"] {
  if (!raw) {
    return null;
  }
  if (raw === AI_SUMMARY_UNAVAILABLE) {
    return AI_SUMMARY_UNAVAILABLE;
  }
  try {
    const parsed = newsSummarySchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : AI_SUMMARY_UNAVAILABLE;
  } catch {
    return AI_SUMMARY_UNAVAILABLE;
  }
}

function serializeAi(value: ResearchItem["aiSummary"]): string | null {
  if (value === null) {
    return null;
  }
  if (value === AI_SUMMARY_UNAVAILABLE) {
    return AI_SUMMARY_UNAVAILABLE;
  }
  return JSON.stringify(value);
}

type ResearchRow = {
  id: string;
  news_id: string | null;
  asset_id: string | null;
  source_name: string;
  source_url: string | null;
  published_at: string | null;
  retrieved_at: string;
  asset_symbol: string | null;
  headline: string | null;
  category: string | null;
  relevance: number | null;
  impact: string | null;
  sentiment: string | null;
  summary: string | null;
  ai_interpretation: string | null;
  information_type: "FACT" | "AI_INTERPRETATION";
  research_status: string;
  content_hash: string | null;
};

function toItem(row: ResearchRow): ResearchItem {
  return {
    id: row.id,
    newsId: row.news_id,
    headline: row.headline ?? row.summary ?? "",
    summary: row.summary,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    assetSymbol: row.asset_symbol,
    category: isNewsCategory(row.category) ? row.category : null,
    relevance: isImpact(row.impact)
      ? row.impact
      : relevanceFromScore(row.relevance === null ? null : Number(row.relevance)),
    sentiment: isSentiment(row.sentiment) ? row.sentiment : "UNKNOWN",
    publishedAt: row.published_at ? new Date(row.published_at) : null,
    retrievedAt: new Date(row.retrieved_at),
    researchStatus: isStatus(row.research_status) ? row.research_status : "NEW",
    informationType: row.information_type,
    aiSummary: parseAi(row.ai_interpretation),
  };
}

export const supabaseResearchPersistence: ResearchPersistence = {
  async upsertFromNews(item) {
    const client = await getAdmin();
    if (!client) {
      return item;
    }

    let assetId: string | null = null;
    if (item.assetSymbol) {
      const { data } = await client
        .from("assets")
        .select("id")
        .eq("symbol", normalizeInternalSymbol(item.assetSymbol))
        .maybeSingle();
      assetId = data?.id ?? null;
    }

    const row = {
      news_id: item.newsId,
      asset_id: assetId,
      source_name: item.sourceName,
      source_url: item.sourceUrl,
      published_at: item.publishedAt?.toISOString() ?? null,
      retrieved_at: item.retrievedAt.toISOString(),
      asset_symbol: item.assetSymbol,
      headline: item.headline,
      category: item.category,
      relevance: item.relevance ? RELEVANCE_SCORE[item.relevance] : null,
      impact: item.relevance,
      sentiment: item.sentiment,
      summary: item.summary,
      ai_interpretation: serializeAi(item.aiSummary),
      information_type: item.informationType,
      research_status: item.researchStatus,
      content_hash: item.id.length === 64 ? item.id : null,
    };

    if (item.newsId) {
      const { data: existing } = await client
        .from("research_items")
        .select("*")
        .eq("news_id", item.newsId)
        .maybeSingle();
      if (existing) {
        const { data } = await client
          .from("research_items")
          .update(row)
          .eq("id", existing.id)
          .select("*")
          .maybeSingle();
        return data ? toItem(data as ResearchRow) : item;
      }
    }

    const { data, error } = await client
      .from("research_items")
      .insert(row)
      .select("*")
      .maybeSingle();

    if (error || !data) {
      return item;
    }
    return toItem(data as ResearchRow);
  },

  async listResearch(filters: ResearchListFilters) {
    const client = await getAdmin();
    if (!client) {
      return [];
    }

    let query = client
      .from("research_items")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(filters.limit);

    if (filters.asset) {
      query = query.eq("asset_symbol", normalizeInternalSymbol(filters.asset));
    }
    if (filters.category) {
      query = query.eq("category", filters.category);
    }
    if (filters.relevance) {
      query = query.eq("impact", filters.relevance);
    }

    const { data } = await query;
    return (data ?? []).map((row) => toItem(row as ResearchRow));
  },

  async getByNewsId(newsId: string) {
    const client = await getAdmin();
    if (!client) {
      return null;
    }
    const { data } = await client
      .from("research_items")
      .select("*")
      .eq("news_id", newsId)
      .maybeSingle();
    return data ? toItem(data as ResearchRow) : null;
  },
};
