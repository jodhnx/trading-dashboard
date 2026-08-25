import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { StoredNews } from "@/services/news/types";
import { isNewsStale } from "@/services/news/stale";

function formatStamp(value: Date): string {
  return value.toLocaleString("de-DE");
}

function sentimentTone(sentiment: StoredNews["sentiment"]) {
  if (sentiment === "POSITIVE") {
    return "positive" as const;
  }
  if (sentiment === "NEGATIVE") {
    return "negative" as const;
  }
  if (sentiment === "UNKNOWN") {
    return "neutral" as const;
  }
  return "accent" as const;
}

export function NewsCard({
  item,
  now = new Date(),
}: {
  item: StoredNews;
  now?: Date;
}) {
  const stale = isNewsStale(item.publishedAt, now);
  const asset = item.assetSymbols[0] ?? "UNMAPPED";

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link href={`/news/${item.id}`} className="text-sm font-semibold hover:text-accent">
          {item.title}
        </Link>
        <div className="flex flex-wrap gap-1">
          {item.isMock ? <Badge tone="warning">MOCK</Badge> : null}
          {stale ? <Badge tone="warning">STALE</Badge> : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        <Badge>{asset}</Badge>
        <Badge>{item.category}</Badge>
        <Badge tone={item.relevance === "CRITICAL" || item.relevance === "HIGH" ? "warning" : "neutral"}>
          {item.relevance}
        </Badge>
        <Badge tone={sentimentTone(item.sentiment)}>{item.sentiment}</Badge>
      </div>
      {item.summary ? (
        <p className="text-sm text-muted">{item.summary}</p>
      ) : (
        <p className="text-sm text-muted">No source summary.</p>
      )}
      <dl className="grid gap-1 text-xs text-muted sm:grid-cols-2">
        <div>
          <dt className="uppercase tracking-wide">Source</dt>
          <dd className="text-foreground">{item.sourceName}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide">Published</dt>
          <dd className="text-foreground">{formatStamp(item.publishedAt)}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide">Retrieved</dt>
          <dd className="text-foreground">{formatStamp(item.retrievedAt)}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide">Original</dt>
          <dd>
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent hover:underline"
            >
              Open source
            </a>
          </dd>
        </div>
      </dl>
    </Card>
  );
}
