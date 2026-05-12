create extension if not exists pg_trgm;

create index if not exists idx_comments_content_trgm
  on comments using gin (lower(content) gin_trgm_ops)
  where target_type = 'memo';
