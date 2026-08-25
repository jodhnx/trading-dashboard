import type { ImpactLevel, NewsCategory, ResearchStatus, Sentiment } from "@/types/enums";
import type { NewsSummary } from "@/ai/schemas/news-summary";
import { AI_SUMMARY_UNAVAILABLE } from "@/ai/schemas/news-summary";

export type ResearchItem = {
  id: string;
  newsId: string | null;
  headline: string;
  summary: string | null;
  sourceName: string;
  sourceUrl: string | null;
  assetSymbol: string | null;
  category: NewsCategory | null;
  relevance: ImpactLevel | null;
  sentiment: Sentiment;
  publishedAt: Date | null;
  retrievedAt: Date;
  researchStatus: ResearchStatus;
  informationType: "FACT" | "AI_INTERPRETATION";
  aiSummary:
    | NewsSummary
    | typeof AI_SUMMARY_UNAVAILABLE
    | null;
};

export type ResearchListFilters = {
  asset?: string;
  category?: NewsCategory;
  relevance?: ImpactLevel;
  limit: number;
};

export type ResearchPersistence = {
  upsertFromNews: (item: ResearchItem) => Promise<ResearchItem>;
  listResearch: (filters: ResearchListFilters) => Promise<ResearchItem[]>;
  getByNewsId: (newsId: string) => Promise<ResearchItem | null>;
};
