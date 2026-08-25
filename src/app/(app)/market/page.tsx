import { QuoteCard } from "@/components/market/quote-card";
import { MarketRetryButton } from "@/components/market/retry-button";
import { ErrorState } from "@/components/states/error-state";
import { createMarketDataService } from "@/services/market/create-service";
import { MARKET_WATCHLIST } from "@/services/market/symbols";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const service = createMarketDataService();
  const items = await service.getOverview(
    MARKET_WATCHLIST.map((asset) => asset.symbol),
  );
  const unavailable = items.filter((item) => item.status === "UNAVAILABLE");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Market</h2>
          <p className="text-sm text-muted">
            Quotes via MarketDataProvider. Twelve Data is never called from the browser.
          </p>
        </div>
        <MarketRetryButton />
      </div>

      {unavailable.length === items.length ? (
        <ErrorState
          title="MARKET DATA UNAVAILABLE"
          description="No live, cached, or mock quotes could be loaded. Retry after checking TWELVE_DATA_API_KEY."
        />
      ) : null}

      <section>
        <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted">
          Market Overview
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <QuoteCard key={item.symbol} result={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
