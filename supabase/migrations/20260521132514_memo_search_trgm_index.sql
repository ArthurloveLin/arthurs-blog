-- pg_trgm is already enabled; add a GIN index on comments.content so that
-- ILIKE '%keyword%' queries can use the index instead of a sequential scan.
-- This is required for multi-keyword AND search to remain fast as the table grows.
CREATE INDEX IF NOT EXISTS idx_comments_content_trgm
  ON comments USING gin (content gin_trgm_ops);