-- 博客文章索引表（数据源：Cloudflare R2）
create table if not exists posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  summary      text,
  tags         text[] default '{}',
  r2_key       text not null,
  published    boolean default false,
  published_at timestamptz,
  updated_at   timestamptz default now()
);

-- RLS
alter table posts enable row level security;

create policy "公开已发布文章"
  on posts for select
  using (published = true);

-- 更新时间自动刷新
create or replace function update_posts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger posts_updated_at
  before update on posts
  for each row execute procedure update_posts_updated_at();
