import { NewsCard } from "@/components/news/news-card";
import { NewsRefreshButton } from "@/components/news/news-refresh-button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { createNewsService } from "@/services/news/create-service";
import { NewsUnavailableError } from "@/services/news/errors";
import type { NewsListResult } from "@/services/news/types";

export const dynamic = "force-dynamic";

async function loadNews(): Promise<NewsListResult> {
  try {
    return await createNewsService().listNews({ limit: 50 });
  } catch (error) {
    if (error instanceof NewsUnavailableError) {
      return { items: [], status: "UNAVAILABLE", source: null };
    }
    return { items: [], status: "UNAVAILABLE", source: null };
  }
}

export default async function NewsPage() {
  const result = await loadNews();
  const unavailable = result.status === "UNAVAILABLE";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">News</h2>
          <p className="text-sm text-muted">
            Stored headlines only. Pages do not call the news provider on render.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {result.status === "MOCK" ? <Badge tone="warning">MOCK NEWS</Badge> : null}
          {unavailable ? <Badge tone="negative">NEWS UNAVAILABLE</Badge> : null}
          <NewsRefreshButton />
        </div>
      </div>

      {unavailable && result.items.length === 0 ? (
        <ErrorState
          title="NEWS UNAVAILABLE"
          description="News could not be loaded. Check NEWS_API_KEY, the news provider, and that the Phase 5 migration is applied."
        />
      ) : null}

      <section className="space-y-3">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Top News
        </h3>
        {result.items.length === 0 && !unavailable ? (
          <EmptyState
            title="NO STORED NEWS"
            description="Load news to fetch from the configured provider. Production never shows silent mock headlines."
          />
        ) : (
          result.items.map((item) => <NewsCard key={item.id} item={item} />)
        )}
      </section>
    </div>
  );
}
