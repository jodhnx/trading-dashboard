"use client";

import type { OpportunityCandidate } from "@/services/opportunity/present";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function SectorConcentrationBanner({
  warnings,
}: {
  warnings: Array<{
    sector: string;
    symbols: string[];
    message: string;
    measuredCorrelation: false;
  }>;
}) {
  if (warnings.length === 0) return null;

  return (
    <Card className="space-y-2 border-warning/40 bg-warning/5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-warning">
        Sector concentration warning
      </p>
      {warnings.slice(0, 3).map((warning) => (
        <div key={warning.sector} className="space-y-1 text-xs">
          <p className="font-medium">High exposure to: {warning.sector.toUpperCase()}</p>
          <div className="flex flex-wrap gap-1">
            {warning.symbols.map((symbol) => (
              <Badge key={symbol} tone="warning">
                {symbol}
              </Badge>
            ))}
          </div>
          <p className="text-muted">{warning.message}</p>
        </div>
      ))}
    </Card>
  );
}

export function DiscoveredTodaySection({
  items,
}: {
  items: OpportunityCandidate[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold">Discovered today</h2>
        <p className="text-[11px] text-muted">
          Broad scanner research candidates — not actionable trades unless they also pass
          trade gates.
        </p>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {items.slice(0, 12).map((item) => (
          <Card key={item.symbol} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-semibold">{item.symbol}</span>
              <Badge tone="warning">{item.boardQualityLabel ?? "DISCOVERED"}</Badge>
            </div>
            <div className="flex flex-wrap gap-1">
              {(item.discoveryTags ?? []).slice(0, 4).map((tag) => (
                <Badge key={tag} tone="neutral">
                  {tag.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted">{item.whyRanked}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function BlockedAndDataQualitySection({
  blocked,
  dataSkipped,
}: {
  blocked: OpportunityCandidate[];
  dataSkipped: OpportunityCandidate[];
}) {
  if (blocked.length === 0 && dataSkipped.length === 0) return null;

  return (
    <section className="grid gap-3 lg:grid-cols-2">
      {blocked.length > 0 ? (
        <Card className="space-y-2">
          <h2 className="text-sm font-semibold">Blocked setups</h2>
          <p className="text-[11px] text-muted">
            Technical evidence exists but safety gates prevent actionable classification.
          </p>
          <ul className="space-y-2 text-xs">
            {blocked.slice(0, 8).map((item) => (
              <li key={item.symbol} className="rounded border border-border/60 p-2">
                <span className="font-mono font-semibold">{item.symbol}</span>
                <p className="text-muted">
                  {item.blockReason
                    ? item.blockReason.replace(/_/g, " ").toLowerCase()
                    : "Blocked by safety gate"}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {dataSkipped.length > 0 ? (
        <Card className="space-y-2">
          <h2 className="text-sm font-semibold">Data skipped</h2>
          <p className="text-[11px] text-muted">
            Provider data was unavailable — these rows are not negative market signals.
          </p>
          <ul className="space-y-2 text-xs">
            {dataSkipped.slice(0, 8).map((item) => (
              <li key={item.symbol} className="rounded border border-border/60 p-2">
                <span className="font-mono font-semibold">{item.symbol}</span>
                <p className="text-muted">
                  Market data unavailable from configured provider during scan.
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}
