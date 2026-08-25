import type { ImpactLevel, NewsCategory, Sentiment } from "@/types/enums";

export type NewsItem = {
  id: string;
  title: string;
  summary: string | null;
  sourceName: string;
  sourceUrl: string;
  publishedAt: Date;
  retrievedAt: Date;
  assetSymbols: string[];
  category: NewsCategory;
  relevance: ImpactLevel;
  sentiment: Sentiment;
  isMock: boolean;
  contentHash: string;
};

export type StoredNews = NewsItem & {
  assetId: string | null;
};

export type NewsListFilters = {
  asset?: string;
  category?: NewsCategory;
  limit: number;
  from?: Date;
  to?: Date;
  allowMock: boolean;
};

export type NewsListResult = {
  items: StoredNews[];
  status: "LIVE" | "MOCK" | "UNAVAILABLE";
  source: string | null;
};

export type NewsIngestResult = {
  fetched: number;
  stored: number;
  duplicates: number;
  rejected: number;
  status: "LIVE" | "MOCK" | "UNAVAILABLE";
  source: string | null;
};

export type NewsPersistence = {
  upsertNews: (items: StoredNews[]) => Promise<StoredNews[]>;
  listNews: (filters: NewsListFilters) => Promise<StoredNews[]>;
  getNewsById: (id: string) => Promise<StoredNews | null>;
  existingHashes: (hashes: string[]) => Promise<Set<string>>;
  existingIdentities: (
    items: Array<{ title: string; sourceName: string; publishedAt: Date }>,
  ) => Promise<Set<string>>;
};
