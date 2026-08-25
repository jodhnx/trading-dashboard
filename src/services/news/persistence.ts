import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { EnvValidationError } from "@/lib/env/errors";
import { IMPACT_LEVELS, NEWS_CATEGORIES, SENTIMENTS } from "@/types/enums";
import type { ImpactLevel, NewsCategory, Sentiment } from "@/types/enums";
import { normalizeInternalSymbol } from "@/services/market/symbols";
import { NewsUnavailableError } from "./errors";
import { newsIdentityKey } from "./hash";
import { RELEVANCE_SCORE, relevanceFromScore } from "./classify";
import type { NewsListFilters, NewsPersistence, StoredNews } from "./types";

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

async function findAssetId(
  client: NonNullable<Awaited<ReturnType<typeof getAdmin>>>,
  symbol: string,
): Promise<string | null> {
  const { data } = await client
    .from("assets")
    .select("id")
    .eq("symbol", normalizeInternalSymbol(symbol))
    .maybeSingle();
  return data?.id ?? null;
}

type NewsRow = {
  id: string;
  asset_id: string | null;
  source_name: string;
  source_url: string | null;
  title: string;
  summary: string | null;
  published_at: string;
  retrieved_at: string;
  category: string;
  relevance: number | null;
  sentiment: string;
  impact: string | null;
  content_hash: string;
  is_mock: boolean;
  assets?: { symbol: string } | { symbol: string }[] | null;
};

function isNewsCategory(value: unknown): value is NewsCategory {
  return (NEWS_CATEGORIES as readonly string[]).includes(String(value));
}

function isImpact(value: unknown): value is ImpactLevel {
  return (IMPACT_LEVELS as readonly string[]).includes(String(value));
}

function isSentiment(value: unknown): value is Sentiment {
  return (SENTIMENTS as readonly string[]).includes(String(value));
}

function assetSymbolFromRow(row: NewsRow): string[] {
  const related = row.assets;
  const symbol = Array.isArray(related) ? related[0]?.symbol : related?.symbol;
  return symbol ? [symbol] : [];
}

function toStored(row: NewsRow): StoredNews | null {
  const publishedAt = new Date(row.published_at);
  const retrievedAt = new Date(row.retrieved_at);
  if (Number.isNaN(publishedAt.getTime()) || Number.isNaN(retrievedAt.getTime())) {
    return null;
  }
  if (!row.source_url) {
    return null;
  }
  const category = isNewsCategory(row.category) ? row.category : "OTHER";
  const relevance = isImpact(row.impact)
    ? row.impact
    : relevanceFromScore(row.relevance === null ? null : Number(row.relevance));
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    publishedAt,
    retrievedAt,
    assetSymbols: assetSymbolFromRow(row),
    category,
    relevance,
    sentiment: isSentiment(row.sentiment) ? row.sentiment : "UNKNOWN",
    isMock: Boolean(row.is_mock),
    contentHash: row.content_hash,
    assetId: row.asset_id,
  };
}

export const supabaseNewsPersistence: NewsPersistence = {
  async upsertNews(items) {
    const client = await getAdmin();
    if (!client) {
      throw new NewsUnavailableError("NEWS UNAVAILABLE", {
        reason: "unconfigured",
      });
    }
    if (items.length === 0) {
      return items;
    }

    const stored: StoredNews[] = [];
    for (const item of items) {
      const assetId = item.assetSymbols[0]
        ? await findAssetId(client, item.assetSymbols[0])
        : null;
      const uniqueAssetId = item.assetSymbols.length === 1 ? assetId : null;

      const { data, error } = await client
        .from("news")
        .upsert(
          {
            asset_id: uniqueAssetId,
            source_name: item.sourceName,
            source_url: item.sourceUrl,
            title: item.title,
            summary: item.summary,
            published_at: item.publishedAt.toISOString(),
            retrieved_at: item.retrievedAt.toISOString(),
            category: item.category,
            relevance: RELEVANCE_SCORE[item.relevance],
            sentiment: item.sentiment,
            impact: item.relevance,
            content_hash: item.contentHash,
            is_mock: item.isMock,
          },
          { onConflict: "content_hash", ignoreDuplicates: true },
        )
        .select("*, assets(symbol)")
        .maybeSingle();

      if (error?.code === "23505") {
        continue;
      }
      if (error) {
        throw new NewsUnavailableError("NEWS UNAVAILABLE", {
          reason: "api_error",
        });
      }
      if (!data) {
        continue;
      }
      const mapped = toStored(data as NewsRow);
      stored.push(mapped ?? { ...item, assetId: uniqueAssetId });
    }
    return stored;
  },

  async listNews(filters: NewsListFilters) {
    const client = await getAdmin();
    if (!client) {
      throw new NewsUnavailableError("NEWS UNAVAILABLE", {
        reason: "unconfigured",
      });
    }

    let query = client
      .from("news")
      .select("*, assets(symbol)")
      .order("published_at", { ascending: false })
      .limit(filters.limit);

    if (!filters.allowMock) {
      query = query.eq("is_mock", false);
    }
    if (filters.category) {
      query = query.eq("category", filters.category);
    }
    if (filters.from) {
      query = query.gte("published_at", filters.from.toISOString());
    }
    if (filters.to) {
      query = query.lte("published_at", filters.to.toISOString());
    }
    if (filters.asset) {
      const assetId = await findAssetId(client, filters.asset);
      if (!assetId) {
        return [];
      }
      query = query.eq("asset_id", assetId);
    }

    const { data, error } = await query;
    if (error) {
      throw new NewsUnavailableError("NEWS UNAVAILABLE", {
        reason: "api_error",
      });
    }
    return (data ?? [])
      .map((row) => toStored(row as NewsRow))
      .filter((item): item is StoredNews => item !== null);
  },

  async getNewsById(id: string) {
    const client = await getAdmin();
    if (!client) {
      return null;
    }
    const { data } = await client
      .from("news")
      .select("*, assets(symbol)")
      .eq("id", id)
      .maybeSingle();
    return data ? toStored(data as NewsRow) : null;
  },

  async existingHashes(hashes: string[]) {
    const client = await getAdmin();
    if (!client || hashes.length === 0) {
      return new Set<string>();
    }
    const { data, error } = await client
      .from("news")
      .select("content_hash")
      .in("content_hash", hashes);
    if (error) {
      throw new NewsUnavailableError("NEWS UNAVAILABLE", {
        reason: "api_error",
      });
    }
    return new Set((data ?? []).map((row) => row.content_hash));
  },

  async existingIdentities(items) {
    const client = await getAdmin();
    if (!client || items.length === 0) {
      return new Set<string>();
    }

    const times = items.map((item) => item.publishedAt.getTime());
    const min = new Date(Math.min(...times));
    const max = new Date(Math.max(...times));
    const from = new Date(Date.UTC(min.getUTCFullYear(), min.getUTCMonth(), min.getUTCDate()));
    const to = new Date(
      Date.UTC(max.getUTCFullYear(), max.getUTCMonth(), max.getUTCDate() + 1),
    );

    const { data, error } = await client
      .from("news")
      .select("title, source_name, published_at")
      .gte("published_at", from.toISOString())
      .lt("published_at", to.toISOString());
    if (error) {
      throw new NewsUnavailableError("NEWS UNAVAILABLE", {
        reason: "api_error",
      });
    }

    const keys = new Set<string>();
    for (const row of data ?? []) {
      const publishedAt = new Date(row.published_at);
      if (Number.isNaN(publishedAt.getTime())) {
        continue;
      }
      keys.add(
        newsIdentityKey({
          title: row.title,
          sourceName: row.source_name,
          publishedAt,
        }),
      );
    }
    return keys;
  },
};
