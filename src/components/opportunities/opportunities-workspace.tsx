"use client";

import { useEffect, useMemo, useState } from "react";
import type { OpportunityCandidate } from "@/services/opportunity/present";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MarketIntelligenceHeader } from "@/components/opportunities/market-intelligence-header";
import { OpportunityScreener } from "@/components/opportunities/opportunity-screener";
import { TopCandidatesSection } from "@/components/opportunities/top-candidates-section";
import {
  BlockedAndDataQualitySection,
  DiscoveredTodaySection,
  SectorConcentrationBanner,
} from "@/components/opportunities/research-sections";
import { ActionableSetupsSection } from "@/components/opportunities/daily-summary-bar";

type OpportunitiesPayload = {
  ok: boolean;
  date: string;
  boardState: string;
  marketRegime: string;
  scanTimestamp: string | null;
  lastMarketUpdate?: string | null;
  lastNewsUpdate?: string | null;
  lastAiUpdate?: string | null;
  noHighConfidence: boolean;
  bestStock: OpportunityCandidate | null;
  bestCrypto: OpportunityCandidate | null;
  whyNoBestStock?: string | null;
  whyNoBestCrypto?: string | null;
  actionableTrades: OpportunityCandidate[];
  candidates: OpportunityCandidate[];
  discovered: OpportunityCandidate[];
  blocked?: OpportunityCandidate[];
  dataSkipped?: OpportunityCandidate[];
  speculative?: OpportunityCandidate[];
  developing?: OpportunityCandidate[];
  sectorExposureWarnings?: Array<{
    sector: string;
    symbols: string[];
    message: string;
    measuredCorrelation: false;
  }>;
  summary: {
    assetsInCatalog?: number;
    assetsEvaluated?: number;
    actionableTrades?: number;
    developing?: number;
    speculative?: number;
    watch?: number;
    blocked?: number;
    discovered?: number;
    dataSkipped?: number;
    lastMarketUpdate?: string | null;
    lastNewsUpdate?: string | null;
    lastAiUpdate?: string | null;
    marketRegime?: string;
    freshness?: {
      live?: number;
      recent?: number;
      cached?: number;
      stale?: number;
      unavailable?: number;
    };
  };
  message?: string;
  disclaimer: string;
  schedulerNote?: string;
};

function pickActionable(
  trades: OpportunityCandidate[],
  assetType: OpportunityCandidate["assetType"],
): OpportunityCandidate | null {
  return trades.find((item) => item.actionable && item.assetType === assetType) ?? null;
}

export function OpportunitiesWorkspace() {
  const [data, setData] = useState<OpportunitiesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paperSymbols, setPaperSymbols] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [oppResponse, paperResponse] = await Promise.all([
          fetch("/api/opportunities"),
          fetch("/api/paper"),
        ]);
        const payload = (await oppResponse.json().catch(() => null)) as
          | OpportunitiesPayload
          | { error?: string }
          | null;
        if (cancelled) return;
        if (!oppResponse.ok || !payload || !("ok" in payload) || !payload.ok) {
          setError(
            payload && "error" in payload
              ? payload.error ?? "Failed to load opportunities"
              : "Failed to load opportunities",
          );
          return;
        }
        setData(payload);

        if (paperResponse.ok) {
          const paper = (await paperResponse.json().catch(() => null)) as {
            account?: { openPositions?: Array<{ symbol: string }> };
          } | null;
          setPaperSymbols(
            paper?.account?.openPositions?.map((position) => position.symbol) ?? [],
          );
        }
      } catch {
        if (!cancelled) setError("Failed to load opportunities");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const mergedWarnings = useMemo(() => {
    if (!data) return [];
    const warnings = [...(data.sectorExposureWarnings ?? [])];
    if (paperSymbols.length >= 2) {
      const paperCandidates = data.candidates.filter((item) =>
        paperSymbols.includes(item.symbol),
      );
      const sectors = new Map<string, string[]>();
      for (const item of paperCandidates) {
        const sector = item.sector ?? "Unknown";
        const list = sectors.get(sector) ?? [];
        list.push(item.symbol);
        sectors.set(sector, list);
      }
      for (const [sector, symbols] of sectors) {
        if (symbols.length >= 2) {
          warnings.push({
            sector,
            symbols,
            message: `Paper portfolio overlap in ${sector}. Category exposure warning only — not measured price correlation.`,
            measuredCorrelation: false as const,
          });
        }
      }
    }
    return warnings;
  }, [data, paperSymbols]);

  const bestActionableStock = useMemo(
    () => (data ? pickActionable(data.actionableTrades, "STOCK") : null),
    [data],
  );
  const bestActionableCrypto = useMemo(
    () => (data ? pickActionable(data.actionableTrades, "CRYPTO") : null),
    [data],
  );
  const highRiskCandidate = useMemo(() => {
    if (!data) return null;
    return (
      data.speculative?.[0] ??
      data.candidates.find(
        (item) => item.riskLevel === "EXTREME" || item.riskLevel === "HIGH",
      ) ??
      null
    );
  }, [data]);
  const developingSetup = useMemo(() => {
    if (!data) return null;
    return data.developing?.[0] ?? data.candidates.find((item) => item.boardQuality === "DEVELOPING") ?? null;
  }, [data]);

  if (error) {
    return (
      <Card>
        <p className="text-sm text-negative">{error}</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <p className="text-sm text-muted">Loading market research terminal…</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
          AI market research terminal
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Opportunities</h1>
        <p className="max-w-3xl text-sm text-muted">
          Professional research view over stored daily scan data for stocks, ETFs and
          crypto. Informational only — not investment advice and not guaranteed profits.
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">{data.boardState.replace(/_/g, " ")}</Badge>
          <Badge tone="accent">{data.marketRegime.replace(/_/g, " ")}</Badge>
          <Badge tone="neutral">{data.date} UTC</Badge>
        </div>
      </header>

      <MarketIntelligenceHeader
        summary={data.summary}
        marketRegime={data.marketRegime}
        scanTimestamp={data.scanTimestamp}
        lastMarketUpdate={data.lastMarketUpdate ?? data.summary.lastMarketUpdate}
        lastNewsUpdate={data.lastNewsUpdate ?? data.summary.lastNewsUpdate}
        boardState={data.boardState}
      />

      <SectorConcentrationBanner warnings={mergedWarnings} />

      <TopCandidatesSection
        bestActionableStock={bestActionableStock}
        bestActionableCrypto={bestActionableCrypto}
        highRiskCandidate={highRiskCandidate}
        developingSetup={developingSetup}
        whyNoBestStock={data.whyNoBestStock}
        whyNoBestCrypto={data.whyNoBestCrypto}
      />

      <ActionableSetupsSection trades={data.actionableTrades} />

      <OpportunityScreener candidates={data.candidates} />

      <DiscoveredTodaySection items={data.discovered} />

      <BlockedAndDataQualitySection
        blocked={data.blocked ?? []}
        dataSkipped={data.dataSkipped ?? []}
      />

      <Card className="space-y-2">
        <p className="text-xs text-muted">{data.message}</p>
        <p className="text-xs text-muted">{data.disclaimer}</p>
        {data.schedulerNote ? (
          <p className="text-[11px] text-muted">{data.schedulerNote}</p>
        ) : null}
        <p className="text-[11px] text-muted">
          Stored scan only — sorting, filtering and detail panels never call market
          providers. Paper exit monitoring is separate on Paper Positions and is not
          continuous real-time on Hobby cron.
        </p>
      </Card>
    </div>
  );
}
