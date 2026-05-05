-- A-1: Tag counts aggregated in DB instead of Node-side full-table scan
CREATE OR REPLACE FUNCTION get_tag_counts()
RETURNS TABLE(tag text, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.tag, COUNT(*) AS count
  FROM posts, unnest(tags) AS t(tag)
  WHERE published = true
  GROUP BY t.tag
  ORDER BY count DESC;
$$;

-- A-2: Category counts aggregated in DB
CREATE OR REPLACE FUNCTION get_category_counts()
RETURNS TABLE(name text, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT category AS name, COUNT(*) AS count
  FROM posts
  WHERE published = true AND category IS NOT NULL
  GROUP BY category
  ORDER BY count DESC;
$$;

-- A-3: Year archive aggregated in DB (excludes current year, matching prior behaviour)
CREATE OR REPLACE FUNCTION get_year_archive()
RETURNS TABLE(year int, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXTRACT(year FROM published_at)::int AS year, COUNT(*) AS count
  FROM posts
  WHERE published = true
    AND published_at IS NOT NULL
    AND EXTRACT(year FROM published_at) < EXTRACT(year FROM now())
  GROUP BY year
  ORDER BY year DESC;
$$;

-- A-4: Comment counts per post aggregated in DB
CREATE OR REPLACE FUNCTION get_blog_comment_counts(post_ids text[])
RETURNS TABLE(target_id text, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT target_id::text, COUNT(*) AS count
  FROM comments
  WHERE target_type = 'blog_post'
    AND target_id::text = ANY(post_ids)
  GROUP BY target_id;
$$;

GRANT EXECUTE ON FUNCTION get_tag_counts() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_category_counts() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_year_archive() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_blog_comment_counts(text[]) TO anon, authenticated;
