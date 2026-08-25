import { Badge } from "@/components/ui/badge";

export function DataFreshness({
  updatedAt,
  now,
  staleAfterMinutes = 30,
}: {
  updatedAt: Date | null;
  now: Date;
  staleAfterMinutes?: number;
}) {
  if (!updatedAt) {
    return <Badge tone="warning">NO CURRENT DATA</Badge>;
  }

  const ageMs = now.getTime() - updatedAt.getTime();
  const stale = ageMs > staleAfterMinutes * 60_000;
  const time = updatedAt.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = updatedAt.toLocaleDateString("de-DE");

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
      <span>
        Last updated: {time} · {date}
      </span>
      {stale ? <Badge tone="warning">STALE DATA</Badge> : null}
    </div>
  );
}
