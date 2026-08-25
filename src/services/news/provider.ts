import type { NewsItem } from "./types";

export interface NewsProvider {
  readonly id: string;
  readonly isMock: boolean;
  getLatestNews(): Promise<NewsItem[]>;
  getAssetNews(symbol: string): Promise<NewsItem[]>;
  getMarketNews(): Promise<NewsItem[]>;
}
