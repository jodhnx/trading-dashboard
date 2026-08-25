import {
  AI_SUMMARY_UNAVAILABLE,
  newsSummarySchema,
  type NewsSummaryResult,
} from "@/ai/schemas/news-summary";
import {
  NEWS_SUMMARY_SYSTEM_PROMPT,
  newsSummaryUserPrompt,
} from "@/ai/prompts/news-summary";
import { MARKET_WATCHLIST } from "@/services/market/symbols";
import type { NewsItem } from "@/services/news/types";

const TRADING_LANGUAGE =
  /\b(BUY_SETUP|NO_TRADE|stop[ -]?loss|take[ -]?profit|position size)\b|\b(buy|sell)\b/i;

export type SummarizeNewsOptions = {
  apiKey: string | null;
  fetchFn?: typeof fetch;
  model?: string;
};

export async function summarizeNews(
  item: Pick<
    NewsItem,
    "title" | "summary" | "sourceName" | "publishedAt" | "assetSymbols" | "category" | "relevance"
  >,
  options: SummarizeNewsOptions,
): Promise<NewsSummaryResult> {
  if (!options.apiKey?.trim()) {
    return { status: AI_SUMMARY_UNAVAILABLE, summary: null };
  }

  let response: Response;
  try {
    response = await (options.fetchFn ?? fetch)(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model ?? "gpt-4o-mini",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: NEWS_SUMMARY_SYSTEM_PROMPT },
            {
              role: "user",
              content: newsSummaryUserPrompt({
                title: item.title,
                summary: item.summary,
                sourceName: item.sourceName,
                publishedAt: item.publishedAt.toISOString(),
                assetSymbols: item.assetSymbols,
                category: item.category,
                relevance: item.relevance,
                watchlist: MARKET_WATCHLIST.map((asset) => asset.symbol),
              }),
            },
          ],
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
  } catch {
    return { status: AI_SUMMARY_UNAVAILABLE, summary: null };
  }

  if (!response.ok) {
    return { status: AI_SUMMARY_UNAVAILABLE, summary: null };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { status: AI_SUMMARY_UNAVAILABLE, summary: null };
  }

  const content = extractContent(payload);
  if (!content) {
    return { status: AI_SUMMARY_UNAVAILABLE, summary: null };
  }
  if (TRADING_LANGUAGE.test(content)) {
    return { status: AI_SUMMARY_UNAVAILABLE, summary: null };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    return { status: AI_SUMMARY_UNAVAILABLE, summary: null };
  }

  if (typeof parsedJson === "object" && parsedJson !== null && "affectedAssets" in parsedJson) {
    const assets = (parsedJson as { affectedAssets: unknown }).affectedAssets;
    if (Array.isArray(assets)) {
      const allowed = new Set(["SPY", "QQQ", "NVDA", "BTC", "XAU", "USD"]);
      (parsedJson as { affectedAssets: string[] }).affectedAssets = assets.filter(
        (asset): asset is string => typeof asset === "string" && allowed.has(asset),
      );
    }
  }

  const parsed = newsSummarySchema.safeParse(parsedJson);
  if (!parsed.success) {
    return { status: AI_SUMMARY_UNAVAILABLE, summary: null };
  }
  if (
    TRADING_LANGUAGE.test(parsed.data.summary) ||
    parsed.data.keyPoints.some((point) => TRADING_LANGUAGE.test(point))
  ) {
    return { status: AI_SUMMARY_UNAVAILABLE, summary: null };
  }

  return { status: "ok", summary: parsed.data };
}

function extractContent(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }
  const first = choices[0] as { message?: { content?: unknown } };
  return typeof first.message?.content === "string" ? first.message.content : null;
}
