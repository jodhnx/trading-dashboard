import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/states/error-state";
import { createNewsService } from "@/services/news/create-service";
import { createResearchService } from "@/services/research/create-service";
import { isNewsStale } from "@/services/news/stale";
import { AI_SUMMARY_UNAVAILABLE } from "@/ai/schemas/news-summary";

export const dynamic = "force-dynamic";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function NewsDetailPage({ params }: PageProps) {
  const { id } = await params;
  if (!UUID.test(id)) {
    notFound();
  }

  const item = await createNewsService().getNewsById(id);
  if (!item) {
    return (
      <div className="space-y-4">
        <Link href="/news" className="text-xs text-muted hover:text-foreground">
          ← News
        </Link>
        <ErrorState
          title="NEWS UNAVAILABLE"
          description="This item is not in the stored news table."
        />
      </div>
    );
  }

  const research = await createResearchService().getByNewsId(item.id);
  const stale = isNewsStale(item.publishedAt);
  const ai = research?.aiSummary ?? null;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/news" className="text-xs text-muted hover:text-foreground">
          ← News
        </Link>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">{item.title}</h2>
      </div>

      <div className="flex flex-wrap gap-1">
        {item.isMock ? <Badge tone="warning">MOCK</Badge> : null}
        {stale ? <Badge tone="warning">STALE</Badge> : null}
        <Badge>{item.assetSymbols[0] ?? "UNMAPPED"}</Badge>
        <Badge>{item.category}</Badge>
        <Badge>{item.relevance}</Badge>
        <Badge>{item.sentiment}</Badge>
      </div>

      <Card className="space-y-2 text-sm">
        <p>{item.summary ?? "No source summary."}</p>
        <dl className="grid gap-2 text-xs text-muted sm:grid-cols-2">
          <div>
            <dt className="uppercase tracking-wide">Source</dt>
            <dd className="text-foreground">{item.sourceName}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide">Published</dt>
            <dd className="text-foreground">{item.publishedAt.toLocaleString("de-DE")}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide">Retrieved</dt>
            <dd className="text-foreground">{item.retrievedAt.toLocaleString("de-DE")}</dd>
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

      <section className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          AI / Research summary
        </h3>
        {!ai ? (
          <p className="text-sm text-muted">No AI summary stored for this item.</p>
        ) : ai === AI_SUMMARY_UNAVAILABLE ? (
          <p className="text-sm text-muted">AI_SUMMARY_UNAVAILABLE</p>
        ) : (
          <Card className="space-y-2 text-sm">
            <p>{ai.summary}</p>
            <p className="text-xs text-muted">
              {ai.category} · {ai.relevance} · {ai.sentiment}
              {ai.affectedAssets.length > 0
                ? ` · ${ai.affectedAssets.join(", ")}`
                : ""}
            </p>
            {ai.keyPoints.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {ai.keyPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            ) : null}
            {ai.uncertainties.length > 0 ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Uncertainties</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {ai.uncertainties.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        )}
      </section>
    </div>
  );
}
