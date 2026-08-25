import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataStatusBadge } from "@/components/market/data-status-badge";
import type { SerializedTechnicalSnapshot } from "@/services/market/serialize";
import type { Timeframe } from "@/types/enums";

export const TECHNICAL_UI_TIMEFRAMES = ["1h", "4h", "1day"] as const;

type Tone = "neutral" | "positive" | "negative" | "warning" | "accent";

function formatPrice(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return value.toFixed(2);
}

function formatRsi(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return value.toFixed(2);
}

function formatAtr(value: number | null, price: number | null): string {
  if (value === null) {
    return "—";
  }
  const digits = price !== null && price >= 50 ? 2 : 4;
  return value.toFixed(digits);
}

function formatMacd(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return value.toFixed(4);
}

function formatVolumeRatio(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return `${value.toFixed(2)}x`;
}

function formatSigned(value: number | null, digits: number): string {
  if (value === null) {
    return "—";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
}

function trendTone(value: string): Tone {
  if (value === "BULLISH" || value === "FAVORABLE" || value === "POSITIVE" || value === "STRONG") {
    return "positive";
  }
  if (value === "BEARISH" || value === "UNFAVORABLE" || value === "NEGATIVE" || value === "WEAK") {
    return "negative";
  }
  if (value === "HIGH" || value === "UNKNOWN" || value === "STALE" || value === "MOCK") {
    return "warning";
  }
  if (value === "LOW") {
    return "accent";
  }
  return "neutral";
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-2/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-mono text-sm font-medium">{value}</p>
    </div>
  );
}

function LevelList({
  title,
  levels,
}: {
  title: string;
  levels: SerializedTechnicalSnapshot["supportLevels"];
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted">{title}</p>
      {levels.length === 0 ? (
        <p className="mt-2 text-sm text-muted">None</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {levels.map((level) => (
            <li
              key={`${title}-${level.price}-${level.touches}`}
              className="flex items-center justify-between font-mono text-sm"
            >
              <span>{level.price.toFixed(2)}</span>
              <span className="text-xs text-muted">
                {level.touches} touches · str {level.strength}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TechnicalPanel({
  snapshot,
  symbol,
}: {
  snapshot: SerializedTechnicalSnapshot;
  symbol: string;
}) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Technical analysis
        </h3>
        <DataStatusBadge status={snapshot.dataStatus} />
      </div>

      <div className="flex flex-wrap gap-2">
        {TECHNICAL_UI_TIMEFRAMES.map((timeframe) => {
          const active = snapshot.timeframe === timeframe;
          return (
            <Link
              key={timeframe}
              href={`/market/${encodeURIComponent(symbol)}?timeframe=${timeframe}`}
              className={
                active
                  ? "rounded-md bg-accent/15 px-2 py-1 font-mono text-xs text-accent"
                  : "rounded-md px-2 py-1 font-mono text-xs text-muted hover:text-foreground"
              }
            >
              {timeframe}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Price" value={formatPrice(snapshot.currentPrice)} />
        <Metric
          label="Change"
          value={`${formatSigned(snapshot.change, 2)} (${formatSigned(snapshot.changePercent, 2)}%)`}
        />
        <Metric label="EMA 20" value={formatPrice(snapshot.ema20)} />
        <Metric label="EMA 50" value={formatPrice(snapshot.ema50)} />
        <Metric label="EMA 200" value={formatPrice(snapshot.ema200)} />
        <Metric label="RSI 14" value={formatRsi(snapshot.rsi14)} />
        <Metric
          label="MACD"
          value={`${formatMacd(snapshot.macd)} / ${formatMacd(snapshot.macdSignal)}`}
        />
        <Metric label="MACD hist" value={formatMacd(snapshot.macdHistogram)} />
        <Metric
          label="ATR 14"
          value={formatAtr(snapshot.atr14, snapshot.currentPrice)}
        />
        <Metric label="Volume ratio" value={formatVolumeRatio(snapshot.volumeRatio)} />
        <Metric label="Volume trend" value={snapshot.volumeTrend} />
        <Metric
          label="Avg vol 20"
          value={
            snapshot.averageVolume20 === null
              ? "—"
              : new Intl.NumberFormat("en-US", { notation: "compact" }).format(
                  snapshot.averageVolume20,
                )
          }
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge tone={trendTone(snapshot.trend)}>Trend {snapshot.trend}</Badge>
        <Badge tone={trendTone(snapshot.momentum)}>
          Momentum {snapshot.momentum}
        </Badge>
        <Badge tone={trendTone(snapshot.volatility)}>
          Volatility {snapshot.volatility}
        </Badge>
        <Badge tone={trendTone(snapshot.technicalCondition)}>
          Condition {snapshot.technicalCondition}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <LevelList title="Support" levels={snapshot.supportLevels} />
        <LevelList title="Resistance" levels={snapshot.resistanceLevels} />
      </div>

      <p className="text-xs text-muted">
        Deterministic indicators from OHLCV only. Condition is not a trade
        recommendation.
      </p>
    </Card>
  );
}

export function isTechnicalUiTimeframe(
  value: string | undefined,
): value is Timeframe {
  return (
    value === "1h" ||
    value === "4h" ||
    value === "1day"
  );
}
