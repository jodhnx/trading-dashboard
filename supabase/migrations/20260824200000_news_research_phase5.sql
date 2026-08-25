-- Phase 5: news + research constraints, status, indexes.
-- Do not edit earlier migrations; this file is additive.

-- Categories were stored lowercase. Align with application enums (EARNINGS, …).
alter table public.news drop constraint if exists news_category_check;

update public.news
set category = upper(category)
where category is not null;

alter table public.news
  add constraint news_category_check
  check (category in (
    'EARNINGS', 'MACRO', 'RATES', 'INFLATION', 'REGULATION',
    'COMPANY', 'CRYPTO', 'GEOPOLITICAL', 'MARKET', 'OTHER'
  ));

alter table public.news
  add column if not exists is_mock boolean not null default false;

create index if not exists idx_news_impact_published
  on public.news (impact, published_at desc);

create index if not exists idx_news_content_hash
  on public.news (content_hash);

create index if not exists idx_news_is_mock_published
  on public.news (is_mock, published_at desc);

-- Research items: status, headline, category, news link, uniqueness.
alter table public.research_items
  add column if not exists news_id uuid references public.news (id) on delete set null;

alter table public.research_items
  add column if not exists headline text;

alter table public.research_items
  add column if not exists category text;

alter table public.research_items
  add column if not exists sentiment text;

alter table public.research_items
  add column if not exists impact text;

alter table public.research_items
  add column if not exists research_status text not null default 'NEW';

alter table public.research_items
  add column if not exists content_hash text;

alter table public.research_items drop constraint if exists research_items_category_check;
alter table public.research_items
  add constraint research_items_category_check
  check (
    category is null or category in (
      'EARNINGS', 'MACRO', 'RATES', 'INFLATION', 'REGULATION',
      'COMPANY', 'CRYPTO', 'GEOPOLITICAL', 'MARKET', 'OTHER'
    )
  );

alter table public.research_items drop constraint if exists research_items_sentiment_check;
alter table public.research_items
  add constraint research_items_sentiment_check
  check (
    sentiment is null or sentiment in ('POSITIVE', 'NEGATIVE', 'NEUTRAL', 'UNKNOWN')
  );

alter table public.research_items drop constraint if exists research_items_impact_check;
alter table public.research_items
  add constraint research_items_impact_check
  check (
    impact is null or impact in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
  );

alter table public.research_items drop constraint if exists research_items_research_status_check;
alter table public.research_items
  add constraint research_items_research_status_check
  check (research_status in ('NEW', 'REVIEWED', 'ARCHIVED', 'INVALID'));

create unique index if not exists idx_research_items_news_id_unique
  on public.research_items (news_id);

create unique index if not exists idx_research_items_content_hash_unique
  on public.research_items (content_hash);

create index if not exists idx_research_items_status
  on public.research_items (research_status, published_at desc);

create index if not exists idx_research_items_category
  on public.research_items (category, published_at desc);

create index if not exists idx_research_items_impact
  on public.research_items (impact, published_at desc);
