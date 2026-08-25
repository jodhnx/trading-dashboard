import { Badge } from "@/components/ui/badge";
import type { DataStatus } from "@/services/market/provider";

const TONE: Record<DataStatus, "positive" | "accent" | "warning" | "negative" | "neutral"> = {
  LIVE: "positive",
  CACHED: "accent",
  MOCK: "warning",
  STALE: "warning",
  UNAVAILABLE: "negative",
};

export function DataStatusBadge({ status }: { status: DataStatus }) {
  return <Badge tone={TONE[status]}>{status === "STALE" ? "STALE DATA" : status}</Badge>;
}
