import { Card } from "@/components/ui/card";
import type { BriefNewsItem } from "@/services/daily-brief/types";

function formatPublished(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "UNKNOWN";
  return new Date(ms).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ImportantNews({ items }: { items: BriefNewsItem[] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
        Important news
      </h3>
      <Card className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted">
            No stored news on this brief. DATA UNAVAILABLE / empty — not invented.
          </p>
        ) : (
          items.slice(0, 8).map((item) => (
            <article key={item.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
              <h4 className="text-sm font-medium leading-snug">{item.title}</h4>
              <p className="mt-1 text-xs text-muted">
                {item.sourceName}
                {" · "}
                {formatPublished(item.publishedAt)}
                {" · "}
                {item.assetSymbols.join(", ") || "—"}
                {" · "}
                {item.category}
                {" · "}
                {item.relevance}
              </p>
              {item.summary ? (
                <p className="mt-1 text-xs text-muted">{item.summary}</p>
              ) : null}
              {item.sourceUrl ? (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-accent hover:underline"
                >
                  Open source
                </a>
              ) : null}
            </article>
          ))
        )}
      </Card>
    </section>
  );
}
