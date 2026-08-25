import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { DataStatusBadge } from "@/components/market/data-status-badge";
import { PriceChart } from "@/components/market/price-chart";
import { MarketRetryButton } from "@/components/market/retry-button";
import {
  TechnicalPanel,
  isTechnicalUiTimeframe,
} from "@/components/market/technical-panel";
import { NewsCard } from "@/components/news/news-card";
import { ErrorState } from "@/components/states/error-state";
import { EmptyState } from "@/components/states/empty-state";
import { TradingSetupPanel } from "@/components/market/trading-setup-panel";
import { AiAnalysisPanel } from "@/components/market/ai-analysis-panel";
import { createMarketDataService } from "@/services/market/create-service";
import { listOwnAnalyses } from "@/services/ai/persistence";
import { createNewsService } from "@/services/news/create-service";
import {
  serializeCandleResult,
  serializeTechnicalSnapshot,
  serializeTradingSetup,
} from "@/services/market/serialize";
import { getWatchAsset, normalizeInternalSymbol } from "@/services/market/symbols";
import { symbolSchema } from "@/services/market/schemas";
import type { Timeframe } from "@/types/enums";
import { getAuthUser } from "@/lib/auth/session";
import { getOrCreateAccountSettings } from "@/lib/settings/service";
import { toTradingRiskSettings } from "@/lib/settings/schema";
import { buildTradingSetup } from "@/engine/trading/setup";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ timeframe?: string | string[] }>;
};

export default async function MarketSymbolPage({ params, searchParams }: PageProps) {
  const { symbol: raw } = await params;
  const query = await searchParams;
  const parsed = symbolSchema.safeParse(decodeURIComponent(raw));
  if (!parsed.success) {
    notFound();
  }

  const rawTimeframe = Array.isArray(query.timeframe)
    ? query.timeframe[0]
    : query.timeframe;
  const timeframe: Timeframe = isTechnicalUiTimeframe(rawTimeframe)
    ? rawTimeframe
    : "1day";

  const symbol = normalizeInternalSymbol(parsed.data);
  const watched = getWatchAsset(symbol);
  const service = createMarketDataService();
  const newsService = createNewsService();
  const user = await getAuthUser();
  const [quoteResult, technicalResult] = await Promise.all([
    service.getQuote(symbol),
    service.getTechnicalSnapshot(symbol, timeframe),
  ]);
  let tradingSetup = null;
  let analysisHistory: Awaited<ReturnType<typeof listOwnAnalyses>> = [];
  if (user) {
    try {
      const settings = await getOrCreateAccountSettings(user.id, user.email ?? null);
      tradingSetup = serializeTradingSetup(
        buildTradingSetup({
          snapshot: technicalResult.snapshot,
          settings: toTradingRiskSettings(settings),
        }),
      );
    } catch {
      tradingSetup = null;
    }
    try {
      analysisHistory = await listOwnAnalyses({
        userId: user.id,
        symbol,
        limit: 10,
      });
    } catch {
      analysisHistory = [];
    }
  }
  let newsResult: Awaited<ReturnType<typeof newsService.listNews>> = {
    items: [],
    status: "UNAVAILABLE",
    source: null,
  };
  try {
    newsResult = await newsService.listNews({ asset: symbol, limit: 5 });
  } catch {
    newsResult = { items: [], status: "UNAVAILABLE", source: null };
  }
  const chart = serializeCandleResult({
    symbol,
    timeframe,
    status: technicalResult.snapshot.dataStatus,
    source: technicalResult.source,
    candles: technicalResult.candles,
  });
  const snapshot = serializeTechnicalSnapshot(technicalResult.snapshot);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/market" className="text-xs text-muted hover:text-foreground">
            ← Market
          </Link>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            {symbol}
            {watched ? <span className="ml-2 text-sm font-normal text-muted">{watched.name}</span> : null}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <DataStatusBadge status={quoteResult.status} />
          <MarketRetryButton />
        </div>
      </div>

      {!quoteResult.quote ? (
        <ErrorState
          title="MARKET DATA UNAVAILABLE"
          description="No price is available for this symbol. Cached data will appear here if it was stored earlier."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-4">
          <Card>
            <p className="text-[11px] uppercase tracking-wide text-muted">Price</p>
            <p className="mt-1 text-xl font-semibold">
              {quoteResult.quote.price.toFixed(2)}
            </p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-wide text-muted">Change</p>
            <p className="mt-1 text-xl font-semibold">
              {quoteResult.quote.changePercent !== null
                ? `${quoteResult.quote.changePercent.toFixed(2)}%`
                : "—"}
            </p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-wide text-muted">Volume</p>
            <p className="mt-1 text-xl font-semibold">
              {quoteResult.quote.volume !== null
                ? new Intl.NumberFormat("en-US", { notation: "compact" }).format(
                    quoteResult.quote.volume,
                  )
                : "—"}
            </p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-wide text-muted">Source</p>
            <p className="mt-1 text-sm font-medium">{quoteResult.source ?? "UNKNOWN"}</p>
            <p className="mt-1 text-xs text-muted">
              {quoteResult.quote.dataTimestamp.toLocaleString("de-DE")}
            </p>
          </Card>
        </div>
      )}

      <section>
        <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted">
          {timeframe} close
        </h3>
        {technicalResult.snapshot.dataStatus === "UNAVAILABLE" ? (
          <ErrorState title="MARKET DATA UNAVAILABLE" description="No candles available." />
        ) : (
          <PriceChart candles={chart.candles} />
        )}
        {technicalResult.snapshot.dataStatus === "STALE" ||
        technicalResult.snapshot.dataStatus === "CACHED" ? (
          <p className="mt-2 text-xs text-muted">
            Chart status: {technicalResult.snapshot.dataStatus}
            {technicalResult.source ? ` · ${technicalResult.source}` : ""}
          </p>
        ) : null}
      </section>

      {technicalResult.snapshot.dataStatus === "UNAVAILABLE" ? (
        <ErrorState
          title="TECHNICAL DATA UNAVAILABLE"
          description="Indicators are not estimated when candles are missing."
        />
      ) : (
        <TechnicalPanel snapshot={snapshot} symbol={symbol} />
      )}

      {tradingSetup ? (
        <TradingSetupPanel
          setup={tradingSetup}
          symbol={symbol}
          timeframe={timeframe}
        />
      ) : null}

      {user ? (
        <AiAnalysisPanel
          symbol={symbol}
          timeframe={timeframe}
          initialHistory={analysisHistory}
        />
      ) : null}

      <section className="space-y-3">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Latest News
        </h3>
        {newsResult.items.length === 0 ? (
          <EmptyState
            title="NO ASSET NEWS"
            description={`No stored headlines are uniquely mapped to ${symbol}.`}
          />
        ) : (
          newsResult.items.map((item) => <NewsCard key={item.id} item={item} />)
        )}
      </section>
    </div>
  );
}