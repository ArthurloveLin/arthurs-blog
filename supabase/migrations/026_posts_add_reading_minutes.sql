alter table posts add column if not exists reading_minutes integer not null default 0;

-- Must drop first because return type changes
drop function if exists search_posts(text, integer, integer);

create or replace function search_posts(
  p_query text,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  title text,
  summary text,
  tags text[],
  category text,
  cover_image text,
  r2_key text,
  published boolean,
  published_at timestamptz,
  updated_at timestamptz,
  sticky integer,
  reading_minutes integer,
  search_content text,
  rank double precision,
  matched_fields text[],
  total_count bigint
)
language sql
stable
as $$
  with normalized as (
    select
      lower(trim(coalesce(p_query, ''))) as query,
      '%' || lower(trim(coalesce(p_query, ''))) || '%' as pattern,
      greatest(1, least(coalesce(p_limit, 12), 50)) as safe_limit,
      greatest(coalesce(p_offset, 0), 0) as safe_offset
  ),
  ranked as (
    select
      p.id,
      p.slug,
      p.title,
      p.summary,
      p.tags,
      p.category,
      p.cover_image,
      p.r2_key,
      p.published,
      p.published_at,
      p.updated_at,
      p.sticky,
      p.reading_minutes,
      p.search_content,
      (
        case when lower(p.title) like n.pattern then 36 else 0 end +
        case when lower(coalesce(p.summary, '')) like n.pattern then 10 else 0 end +
        case when lower(coalesce(p.category, '')) like n.pattern then 16 else 0 end +
        case when lower(coalesce(p.search_content, '')) like n.pattern then 8 else 0 end +
        case when exists (
          select 1 from unnest(coalesce(p.tags, '{}'::text[])) as tag
          where lower(tag) like n.pattern
        ) then 18 else 0 end +
        similarity(lower(p.title), n.query) * 18 +
        similarity(lower(coalesce(p.category, '')), n.query) * 8 +
        similarity(lower(coalesce(p.summary, '')), n.query) * 4 +
        similarity(lower(coalesce(p.search_content, '')), n.query) * 2 +
        coalesce((
          select max(similarity(lower(tag), n.query))
          from unnest(coalesce(p.tags, '{}'::text[])) as tag
        ), 0) * 10
      ) as rank,
      array_remove(array[
        case when lower(p.title) like n.pattern then 'title' end,
        case when lower(coalesce(p.summary, '')) like n.pattern then 'summary' end,
        case when exists (
          select 1 from unnest(coalesce(p.tags, '{}'::text[])) as tag
          where lower(tag) like n.pattern
        ) then 'tags' end,
        case when lower(coalesce(p.category, '')) like n.pattern then 'category' end,
        case when lower(coalesce(p.search_content, '')) like n.pattern then 'content' end
      ], null) as matched_fields
    from posts p
    cross join normalized n
    where p.published = true
      and n.query <> ''
      and (
        lower(p.title) like n.pattern
        or lower(coalesce(p.summary, '')) like n.pattern
        or lower(coalesce(p.category, '')) like n.pattern
        or lower(coalesce(p.search_content, '')) like n.pattern
        or exists (
          select 1 from unnest(coalesce(p.tags, '{}'::text[])) as tag
          where lower(tag) like n.pattern
        )
        or similarity(lower(p.title), n.query) > 0.1
        or similarity(lower(coalesce(p.category, '')), n.query) > 0.12
        or similarity(lower(coalesce(p.summary, '')), n.query) > 0.08
        or similarity(lower(coalesce(p.search_content, '')), n.query) > 0.06
        or exists (
          select 1 from unnest(coalesce(p.tags, '{}'::text[])) as tag
          where similarity(lower(tag), n.query) > 0.12
        )
      )
  )
  select
    ranked.id,
    ranked.slug,
    ranked.title,
    ranked.summary,
    ranked.tags,
    ranked.category,
    ranked.cover_image,
    ranked.r2_key,
    ranked.published,
    ranked.published_at,
    ranked.updated_at,
    ranked.sticky,
    ranked.reading_minutes,
    ranked.search_content,
    ranked.rank,
    ranked.matched_fields,
    count(*) over() as total_count
  from ranked
  where ranked.rank > 0
  order by ranked.rank desc, ranked.sticky desc, ranked.published_at desc nulls last
  limit (select safe_limit from normalized)
  offset (select safe_offset from normalized);
$$;
