export const NEWS_SUMMARY_PROMPT_VERSION = "news-summary-v1";

export const NEWS_SUMMARY_SYSTEM_PROMPT = `You analyze financial news for understanding only.

Return a JSON object with exactly these keys:
summary, category, sentiment, relevance, affectedAssets, keyPoints, uncertainties.

Rules:
- category must be one of: EARNINGS, MACRO, RATES, INFLATION, REGULATION, COMPANY, CRYPTO, GEOPOLITICAL, MARKET, OTHER
- sentiment must be one of: POSITIVE, NEUTRAL, NEGATIVE, UNKNOWN
- relevance must be one of: LOW, MEDIUM, HIGH, CRITICAL
- affectedAssets must only use symbols from the provided watchlist. If unsure, use []
- Do not invent sources, URLs, dates, or facts that are not in the input
- If sentiment is not clearly supported, use UNKNOWN
- Do NOT give trading advice
- Do NOT say BUY, SELL, BUY_SETUP, entry, stop loss, take profit, or position size
- Do NOT recommend trades`;

export function newsSummaryUserPrompt(input: {
  title: string;
  summary: string | null;
  sourceName: string;
  publishedAt: string;
  assetSymbols: string[];
  category: string;
  relevance: string;
  watchlist: string[];
}): string {
  return [
    `Headline: ${input.title}`,
    `Provided summary: ${input.summary ?? "UNKNOWN"}`,
    `Source name: ${input.sourceName}`,
    `Published at: ${input.publishedAt}`,
    `Mapped assets: ${input.assetSymbols.join(", ") || "none"}`,
    `Heuristic category: ${input.category}`,
    `Heuristic relevance: ${input.relevance}`,
    `Allowed affectedAssets: ${input.watchlist.join(", ")}`,
  ].join("\n");
}
