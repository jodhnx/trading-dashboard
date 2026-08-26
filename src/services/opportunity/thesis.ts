import type { TechnicalSnapshot } from "@/engine/technical/technical-snapshot";
import type { TradingSetup } from "@/engine/trading/types";
import type { MtfAlignment, OpportunityNewsItem, SignalQuality } from "./types";

export function buildThesis(input: {
  setup: TradingSetup;
  snapshot: TechnicalSnapshot;
  quality: SignalQuality;
  newsItems: OpportunityNewsItem[];
  mtf: MtfAlignment;
}): string {
  const parts: string[] = [];
  if (input.quality === "EARLY_SETUP") {
    parts.push("Developing setup — wait for confirmation before treating as a trade");
  }
  if (input.setup.confirmation?.explain) {
    parts.push(input.setup.confirmation.explain);
  } else if (input.setup.reasons[0]) {
    parts.push(input.setup.reasons[0]);
  } else {
    parts.push(
      `Trend ${input.snapshot.trend}; momentum ${input.snapshot.momentum}`,
    );
  }
  if (input.mtf.aligned) {
    parts.push("Multi-timeframe trends aligned");
  } else if (input.mtf.notes[0]) {
    parts.push(input.mtf.notes[0]);
  }
  const catalyst = input.newsItems.find(
    (n) =>
      n.category.toLowerCase().includes("catalyst") ||
      n.impactScore >= 70 ||
      n.sentiment === "POSITIVE" ||
      n.sentiment === "NEGATIVE",
  );
  if (catalyst) {
    parts.push(`News: ${catalyst.title}`);
  }
  return parts.slice(0, 4).join(" · ");
}
