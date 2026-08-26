import Link from "next/link";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DailyDecisionCard } from "@/components/dashboard/daily-decision-card";
import { MarketOverview } from "@/components/dashboard/market-overview";
import { TopOpportunities } from "@/components/dashboard/top-opportunities";
import { TradingSignalsPanel } from "@/components/dashboard/trading-signals-panel";
import { Watchlist } from "@/components/dashboard/watchlist";
import { NoTradeAssets } from "@/components/dashboard/no-trade-assets";
import { ImportantNews } from "@/components/dashboard/important-news";
import { RiskPanel } from "@/components/dashboard/risk-panel";
import { BriefHistory } from "@/components/dashboard/brief-history";
import { DataFreshness } from "@/components/dashboard/data-freshness";
import type { DashboardLoadResult } from "@/services/dashboard/load";

export function DashboardWorkspace({ result }: { result: DashboardLoadResult }) {
  if (result.status === "unauthorized") {
    return (
      <ErrorState
        title="UNAUTHORIZED"
        description="Sign in to view your stored Daily Brief dashboard."
      />
    );
  }

  if (result.status === "database_unavailable") {
    return (
      <ErrorState
        title="DATABASE UNAVAILABLE"
        description="Could not load the stored Daily Brief from Supabase."
      />
    );
  }

  if (result.status === "empty") {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Today
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            {result.today}
            <span className="ml-2 text-sm font-normal text-muted">UTC</span>
          </h2>
        </div>
        <TradingSignalsPanel
          bestStock={result.bestStock}
          bestCrypto={result.bestCrypto}
        />
        <EmptyState
          title="NO DAILY BRIEF YET"
          description="Generate today’s Daily Brief from the Daily Brief page. The dashboard will not invent content or call providers on load."
        />
        <p className="text-sm">
          <Link href="/daily-brief" className="text-accent hover:underline">
            Open Daily Brief →
          </Link>
        </p>
        <BriefHistory items={result.history} />
      </div>
    );
  }

  const { model } = result;

  return (
    <div className="space-y-5">
      <DashboardHeader model={model} />
      <TradingSignalsPanel
        bestStock={result.bestStock}
        bestCrypto={result.bestCrypto}
      />
      <DailyDecisionCard model={model} />
      <MarketOverview items={model.marketOverview} />
      <TopOpportunities opportunities={model.opportunities} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Watchlist items={model.watchlist} />
        <NoTradeAssets items={model.noTradeAssets} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ImportantNews items={model.news} />
        <RiskPanel risks={model.risks} />
      </div>
      <BriefHistory items={model.history} />
      <DataFreshness model={model} />
      <p className="text-xs text-muted">
        <Link href="/opportunities" className="text-accent hover:underline">
          Open Opportunities
        </Link>
        {" · "}
        <Link href="/positions" className="text-accent hover:underline">
          Paper Positions
        </Link>
        {" · "}
        Stored-first — no provider invent on this page load.
      </p>
    </div>
  );
}
