


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."apply_comment_batch"("comments" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  comment_entry jsonb;
  processed_count integer := 0;
BEGIN
  IF comments IS NULL OR jsonb_typeof(comments) <> 'array' THEN
    RAISE EXCEPTION 'comments must be a JSON array';
  END IF;

  FOR comment_entry IN
    SELECT value
    FROM jsonb_array_elements(comments) AS value
  LOOP
    INSERT INTO comments (
      id,
      target_type,
      target_id,
      item_id,
      author,
      content,
      parent_id,
      created_at,
      updated_at,
      upvotes,
      downvotes
    )
    VALUES (
      (comment_entry->>'id')::uuid,
      comment_entry->>'target_type',
      (comment_entry->>'target_id')::uuid,
      CASE
        WHEN comment_entry->>'target_type' = 'wardrobe_item' THEN (comment_entry->>'target_id')::uuid
        ELSE NULL
      END,
      comment_entry->>'author',
      comment_entry->>'content',
      NULLIF(comment_entry->>'parent_id', '')::uuid,
      COALESCE((comment_entry->>'created_at')::timestamptz, now()),
      NULLIF(comment_entry->>'updated_at', '')::timestamptz,
      0,
      0
    )
    ON CONFLICT (id) DO UPDATE
    SET
      target_type = EXCLUDED.target_type,
      target_id = EXCLUDED.target_id,
      item_id = EXCLUDED.item_id,
      author = EXCLUDED.author,
      content = EXCLUDED.content,
      parent_id = EXCLUDED.parent_id,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at;

    processed_count := processed_count + 1;
  END LOOP;

  RETURN processed_count;
END;
$$;


ALTER FUNCTION "public"."apply_comment_batch"("comments" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_blog_comment_counts"("post_ids" "text"[]) RETURNS TABLE("target_id" "text", "count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT target_id::text, COUNT(*) AS count
  FROM comments
  WHERE target_type = 'blog_post'
    AND target_id::text = ANY(post_ids)
  GROUP BY target_id;
$$;


ALTER FUNCTION "public"."get_blog_comment_counts"("post_ids" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_category_counts"() RETURNS TABLE("name" "text", "count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT category AS name, COUNT(*) AS count
  FROM posts
  WHERE published = true AND category IS NOT NULL
  GROUP BY category
  ORDER BY count DESC;
$$;


ALTER FUNCTION "public"."get_category_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tag_counts"() RETURNS TABLE("tag" "text", "count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT t.tag, COUNT(*) AS count
  FROM posts, unnest(tags) AS t(tag)
  WHERE published = true
  GROUP BY t.tag
  ORDER BY count DESC;
$$;


ALTER FUNCTION "public"."get_tag_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_year_archive"() RETURNS TABLE("year" integer, "count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXTRACT(year FROM published_at)::int AS year, COUNT(*) AS count
  FROM posts
  WHERE published = true
    AND published_at IS NOT NULL
    AND EXTRACT(year FROM published_at) < EXTRACT(year FROM now())
  GROUP BY year
  ORDER BY year DESC;
$$;


ALTER FUNCTION "public"."get_year_archive"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_posts"("p_query" "text", "p_limit" integer DEFAULT 12, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "slug" "text", "title" "text", "summary" "text", "tags" "text"[], "category" "text", "cover_image" "text", "r2_key" "text", "published" boolean, "published_at" timestamp with time zone, "updated_at" timestamp with time zone, "sticky" integer, "reading_minutes" integer, "search_content" "text", "rank" double precision, "matched_fields" "text"[], "total_count" bigint)
    LANGUAGE "sql" STABLE
    AS $$
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


ALTER FUNCTION "public"."search_posts"("p_query" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_comment_emoji_reactions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_comment_emoji_reactions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_comment_reactions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_comment_reactions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_comments_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF ROW(
    NEW.author,
    NEW.content,
    NEW.parent_id,
    NEW.target_type,
    NEW.target_id,
    NEW.archived,
    NEW.priority
  ) IS DISTINCT FROM ROW(
    OLD.author,
    OLD.content,
    OLD.parent_id,
    OLD.target_type,
    OLD.target_id,
    OLD.archived,
    OLD.priority
  ) THEN
    NEW.updated_at = now();
  ELSE
    NEW.updated_at = OLD.updated_at;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_comments_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_post_emoji_reactions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_post_emoji_reactions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_post_reactions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_post_reactions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_posts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_posts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_recipes_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_recipes_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."comment_emoji_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "identity" "text" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comment_emoji_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comment_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "identity" "text" NOT NULL,
    "value" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "comment_reactions_value_check" CHECK (("value" = ANY (ARRAY['-1'::integer, 1])))
);


ALTER TABLE "public"."comment_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid",
    "author" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "parent_id" "uuid",
    "target_type" "text" DEFAULT 'wardrobe_item'::"text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "archived" boolean DEFAULT false NOT NULL,
    "priority" smallint DEFAULT 1 NOT NULL,
    "upvotes" integer DEFAULT 0 NOT NULL,
    "downvotes" integer DEFAULT 0 NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    CONSTRAINT "comments_downvotes_nonnegative_check" CHECK (("downvotes" >= 0)),
    CONSTRAINT "comments_priority_range_check" CHECK ((("priority" >= 0) AND ("priority" <= 2))),
    CONSTRAINT "comments_upvotes_nonnegative_check" CHECK (("upvotes" >= 0))
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guest_sessions" (
    "guest_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."guest_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid",
    "image_url" "text" NOT NULL,
    "image_path" "text" NOT NULL,
    "position" integer DEFAULT 0,
    "decision" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "price" integer,
    "notes" "text",
    "category" "text",
    "rank" integer,
    "ocr_status" "text" DEFAULT 'idle'::"text" NOT NULL,
    "ocr_provider" "text",
    "ocr_data" "jsonb",
    "ocr_processed_at" timestamp with time zone,
    CONSTRAINT "items_decision_check" CHECK (("decision" = ANY (ARRAY['buy'::"text", 'skip'::"text", 'pending'::"text"]))),
    CONSTRAINT "items_ocr_status_check" CHECK (("ocr_status" = ANY (ARRAY['idle'::"text", 'pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."items"."rank" IS '对决排名 (1=金, 2=银, 3=铜)';



CREATE TABLE IF NOT EXISTS "public"."post_emoji_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "identity" "text" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."post_emoji_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "identity" "text" NOT NULL,
    "value" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "post_reactions_value_check" CHECK (("value" = ANY (ARRAY['-1'::integer, 1])))
);


ALTER TABLE "public"."post_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "r2_key" "text" NOT NULL,
    "published" boolean DEFAULT false,
    "published_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "category" "text",
    "cover_image" "text",
    "sticky" smallint DEFAULT 0,
    "upvotes" integer DEFAULT 0 NOT NULL,
    "downvotes" integer DEFAULT 0 NOT NULL,
    "search_content" "text" DEFAULT ''::"text" NOT NULL,
    "reading_minutes" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "posts_downvotes_nonnegative_check" CHECK (("downvotes" >= 0)),
    CONSTRAINT "posts_upvotes_nonnegative_check" CHECK (("upvotes" >= 0))
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid",
    "author" "text" NOT NULL,
    "score" numeric(2,1),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "appearance_score" numeric(2,1),
    "practicality_score" numeric(2,1),
    "value_score" numeric(2,1),
    "scores" "jsonb",
    CONSTRAINT "ratings_appearance_score_check" CHECK ((("appearance_score" >= (1)::numeric) AND ("appearance_score" <= (5)::numeric))),
    CONSTRAINT "ratings_practicality_score_check" CHECK ((("practicality_score" >= (1)::numeric) AND ("practicality_score" <= (5)::numeric))),
    CONSTRAINT "ratings_score_check" CHECK ((("score" >= (1)::numeric) AND ("score" <= (5)::numeric))),
    CONSTRAINT "ratings_value_score_check" CHECK ((("value_score" >= (1)::numeric) AND ("value_score" <= (5)::numeric)))
);


ALTER TABLE "public"."ratings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe_prerequisites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_recipe_id" "uuid" NOT NULL,
    "to_recipe_id" "uuid" NOT NULL,
    "skill_label" "text" NOT NULL
);


ALTER TABLE "public"."recipe_prerequisites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe_revisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipe_id" "uuid" NOT NULL,
    "version" "text" NOT NULL,
    "change_summary" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "snapshot" "jsonb"
);


ALTER TABLE "public"."recipe_revisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "cover_image" "text",
    "cover_image_key" "text",
    "category" "text",
    "version" "text" DEFAULT '1.0'::"text" NOT NULL,
    "prep_time_minutes" integer,
    "cook_time_minutes" integer,
    "servings" integer,
    "flavor_sour" smallint,
    "flavor_sweet" smallint,
    "flavor_bitter" smallint,
    "flavor_spicy" smallint,
    "flavor_umami" smallint,
    "flavor_aromatic" smallint,
    "proficiency" smallint,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "suitable_occasions" "text"[] DEFAULT '{}'::"text"[],
    "failure_notes" "text",
    "life_notes" "text",
    "pairing_suggestions" "text",
    "ingredients" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "steps" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "published" boolean DEFAULT false NOT NULL,
    "published_at" timestamp with time zone,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "gallery_images" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "recommendation_rating" integer DEFAULT 5,
    CONSTRAINT "recipes_flavor_aromatic_check" CHECK ((("flavor_aromatic" >= 0) AND ("flavor_aromatic" <= 5))),
    CONSTRAINT "recipes_flavor_bitter_check" CHECK ((("flavor_bitter" >= 0) AND ("flavor_bitter" <= 5))),
    CONSTRAINT "recipes_flavor_sour_check" CHECK ((("flavor_sour" >= 0) AND ("flavor_sour" <= 5))),
    CONSTRAINT "recipes_flavor_spicy_check" CHECK ((("flavor_spicy" >= 0) AND ("flavor_spicy" <= 5))),
    CONSTRAINT "recipes_flavor_sweet_check" CHECK ((("flavor_sweet" >= 0) AND ("flavor_sweet" <= 5))),
    CONSTRAINT "recipes_flavor_umami_check" CHECK ((("flavor_umami" >= 0) AND ("flavor_umami" <= 5))),
    CONSTRAINT "recipes_proficiency_check" CHECK ((("proficiency" >= 1) AND ("proficiency" <= 5))),
    CONSTRAINT "recipes_recommendation_rating_check" CHECK ((("recommendation_rating" >= 0) AND ("recommendation_rating" <= 5)))
);


ALTER TABLE "public"."recipes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text",
    "note" "text",
    "token" "text" NOT NULL,
    "budget" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "archived" boolean DEFAULT false NOT NULL,
    "template_id" "text" DEFAULT 'wardrobe'::"text",
    "template_config" "jsonb"
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_config" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL
);


ALTER TABLE "public"."site_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_roles_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."comment_emoji_reactions"
    ADD CONSTRAINT "comment_emoji_reactions_comment_id_identity_emoji_key" UNIQUE ("comment_id", "identity", "emoji");



ALTER TABLE ONLY "public"."comment_emoji_reactions"
    ADD CONSTRAINT "comment_emoji_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comment_reactions"
    ADD CONSTRAINT "comment_reactions_comment_id_identity_key" UNIQUE ("comment_id", "identity");



ALTER TABLE ONLY "public"."comment_reactions"
    ADD CONSTRAINT "comment_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guest_sessions"
    ADD CONSTRAINT "guest_sessions_pkey" PRIMARY KEY ("guest_id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_emoji_reactions"
    ADD CONSTRAINT "post_emoji_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_emoji_reactions"
    ADD CONSTRAINT "post_emoji_reactions_post_id_identity_emoji_key" UNIQUE ("post_id", "identity", "emoji");



ALTER TABLE ONLY "public"."post_reactions"
    ADD CONSTRAINT "post_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_reactions"
    ADD CONSTRAINT "post_reactions_post_id_identity_key" UNIQUE ("post_id", "identity");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_item_id_author_key" UNIQUE ("item_id", "author");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_prerequisites"
    ADD CONSTRAINT "recipe_prerequisites_from_recipe_id_to_recipe_id_key" UNIQUE ("from_recipe_id", "to_recipe_id");



ALTER TABLE ONLY "public"."recipe_prerequisites"
    ADD CONSTRAINT "recipe_prerequisites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_revisions"
    ADD CONSTRAINT "recipe_revisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."site_config"
    ADD CONSTRAINT "site_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id");



CREATE INDEX "idx_comment_emoji_reactions_comment_id" ON "public"."comment_emoji_reactions" USING "btree" ("comment_id");



CREATE INDEX "idx_comment_emoji_reactions_identity" ON "public"."comment_emoji_reactions" USING "btree" ("identity");



CREATE INDEX "idx_comment_reactions_comment_id" ON "public"."comment_reactions" USING "btree" ("comment_id");



CREATE INDEX "idx_comment_reactions_identity" ON "public"."comment_reactions" USING "btree" ("identity");



CREATE INDEX "idx_comments_content_trgm" ON "public"."comments" USING "gin" ("lower"("content") "public"."gin_trgm_ops") WHERE ("target_type" = 'memo'::"text");



CREATE INDEX "idx_comments_target" ON "public"."comments" USING "btree" ("target_type", "target_id");



CREATE INDEX "idx_post_emoji_reactions_identity" ON "public"."post_emoji_reactions" USING "btree" ("identity");



CREATE INDEX "idx_post_emoji_reactions_post_id" ON "public"."post_emoji_reactions" USING "btree" ("post_id");



CREATE INDEX "idx_post_reactions_identity" ON "public"."post_reactions" USING "btree" ("identity");



CREATE INDEX "idx_post_reactions_post_id" ON "public"."post_reactions" USING "btree" ("post_id");



CREATE INDEX "idx_posts_category_trgm" ON "public"."posts" USING "gin" ("lower"(COALESCE("category", ''::"text")) "public"."gin_trgm_ops");



CREATE INDEX "idx_posts_search_content_trgm" ON "public"."posts" USING "gin" ("lower"("search_content") "public"."gin_trgm_ops");



CREATE INDEX "idx_posts_summary_trgm" ON "public"."posts" USING "gin" ("lower"(COALESCE("summary", ''::"text")) "public"."gin_trgm_ops");



CREATE INDEX "idx_posts_title_trgm" ON "public"."posts" USING "gin" ("lower"("title") "public"."gin_trgm_ops");



CREATE INDEX "idx_recipe_prereqs_from" ON "public"."recipe_prerequisites" USING "btree" ("from_recipe_id");



CREATE INDEX "idx_recipe_prereqs_to" ON "public"."recipe_prerequisites" USING "btree" ("to_recipe_id");



CREATE INDEX "idx_recipe_revisions_recipe_id" ON "public"."recipe_revisions" USING "btree" ("recipe_id", "created_at" DESC);



CREATE INDEX "idx_recipes_category" ON "public"."recipes" USING "btree" ("category") WHERE ("category" IS NOT NULL);



CREATE INDEX "idx_recipes_published" ON "public"."recipes" USING "btree" ("published", "sort_order");



CREATE INDEX "idx_recipes_slug" ON "public"."recipes" USING "btree" ("slug");



CREATE OR REPLACE TRIGGER "comment_emoji_reactions_updated_at" BEFORE UPDATE ON "public"."comment_emoji_reactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_comment_emoji_reactions_updated_at"();



CREATE OR REPLACE TRIGGER "comment_reactions_updated_at" BEFORE UPDATE ON "public"."comment_reactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_comment_reactions_updated_at"();



CREATE OR REPLACE TRIGGER "comments_updated_at" BEFORE UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_comments_updated_at"();



CREATE OR REPLACE TRIGGER "post_emoji_reactions_updated_at" BEFORE UPDATE ON "public"."post_emoji_reactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_post_emoji_reactions_updated_at"();



CREATE OR REPLACE TRIGGER "post_reactions_updated_at" BEFORE UPDATE ON "public"."post_reactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_post_reactions_updated_at"();



CREATE OR REPLACE TRIGGER "posts_updated_at" BEFORE UPDATE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_posts_updated_at"();



CREATE OR REPLACE TRIGGER "recipes_updated_at" BEFORE UPDATE ON "public"."recipes" FOR EACH ROW EXECUTE FUNCTION "public"."update_recipes_updated_at"();



ALTER TABLE ONLY "public"."comment_emoji_reactions"
    ADD CONSTRAINT "comment_emoji_reactions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_reactions"
    ADD CONSTRAINT "comment_reactions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_emoji_reactions"
    ADD CONSTRAINT "post_emoji_reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_reactions"
    ADD CONSTRAINT "post_reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_prerequisites"
    ADD CONSTRAINT "recipe_prerequisites_from_recipe_id_fkey" FOREIGN KEY ("from_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_prerequisites"
    ADD CONSTRAINT "recipe_prerequisites_to_recipe_id_fkey" FOREIGN KEY ("to_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_revisions"
    ADD CONSTRAINT "recipe_revisions_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "anon can read" ON "public"."site_config" FOR SELECT USING (true);



ALTER TABLE "public"."comment_emoji_reactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comment_emoji_reactions_select_all" ON "public"."comment_emoji_reactions" FOR SELECT USING (true);



ALTER TABLE "public"."comment_reactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comment_reactions_select_all" ON "public"."comment_reactions" FOR SELECT USING (true);



ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comments_delete_admin" ON "public"."comments" FOR DELETE USING (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = 'admin'::"text"))));



CREATE POLICY "comments_select_all" ON "public"."comments" FOR SELECT USING (true);



ALTER TABLE "public"."guest_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "items_delete_admin" ON "public"."items" FOR DELETE USING (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = 'admin'::"text"))));



CREATE POLICY "items_insert_admin" ON "public"."items" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = 'admin'::"text"))));



CREATE POLICY "items_select_all" ON "public"."items" FOR SELECT USING (true);



CREATE POLICY "items_update_admin" ON "public"."items" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = 'admin'::"text"))));



ALTER TABLE "public"."post_emoji_reactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "post_emoji_reactions_select_all" ON "public"."post_emoji_reactions" FOR SELECT USING (true);



ALTER TABLE "public"."post_reactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "post_reactions_select_all" ON "public"."post_reactions" FOR SELECT USING (true);



ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recipe_prereqs_admin_all" ON "public"."recipe_prerequisites" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "recipe_prereqs_select" ON "public"."recipe_prerequisites" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."recipes"
  WHERE (("recipes"."id" = "recipe_prerequisites"."from_recipe_id") AND ("recipes"."published" = true)))));



ALTER TABLE "public"."recipe_prerequisites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipe_revisions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recipe_revisions_admin_all" ON "public"."recipe_revisions" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "recipe_revisions_select" ON "public"."recipe_revisions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."recipes"
  WHERE (("recipes"."id" = "recipe_revisions"."recipe_id") AND ("recipes"."published" = true)))));



ALTER TABLE "public"."recipes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recipes_admin_all" ON "public"."recipes" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "recipes_published_select" ON "public"."recipes" FOR SELECT USING (("published" = true));



ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sessions_delete_admin" ON "public"."sessions" FOR DELETE USING (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = 'admin'::"text"))));



CREATE POLICY "sessions_insert_admin" ON "public"."sessions" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = 'admin'::"text"))));



CREATE POLICY "sessions_select_all" ON "public"."sessions" FOR SELECT USING (true);



CREATE POLICY "sessions_update_admin" ON "public"."sessions" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = 'admin'::"text"))));



ALTER TABLE "public"."site_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_roles_select_all" ON "public"."user_roles" FOR SELECT USING (true);



CREATE POLICY "公开已发布文章" ON "public"."posts" FOR SELECT USING (("published" = true));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_comment_batch"("comments" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_comment_batch"("comments" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_comment_batch"("comments" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_blog_comment_counts"("post_ids" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_blog_comment_counts"("post_ids" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_blog_comment_counts"("post_ids" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_category_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_category_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_category_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tag_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_tag_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tag_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_year_archive"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_year_archive"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_year_archive"() TO "service_role";



GRANT ALL ON FUNCTION "public"."search_posts"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_posts"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_posts"("p_query" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_comment_emoji_reactions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_comment_emoji_reactions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_comment_emoji_reactions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_comment_reactions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_comment_reactions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_comment_reactions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_comments_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_comments_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_comments_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_post_emoji_reactions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_post_emoji_reactions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_post_emoji_reactions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_post_reactions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_post_reactions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_post_reactions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_posts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_posts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_posts_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_recipes_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_recipes_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_recipes_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."comment_emoji_reactions" TO "anon";
GRANT ALL ON TABLE "public"."comment_emoji_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."comment_emoji_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."comment_reactions" TO "anon";
GRANT ALL ON TABLE "public"."comment_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."comment_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."guest_sessions" TO "anon";
GRANT ALL ON TABLE "public"."guest_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."guest_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."items" TO "anon";
GRANT ALL ON TABLE "public"."items" TO "authenticated";
GRANT ALL ON TABLE "public"."items" TO "service_role";



GRANT ALL ON TABLE "public"."post_emoji_reactions" TO "anon";
GRANT ALL ON TABLE "public"."post_emoji_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."post_emoji_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."post_reactions" TO "anon";
GRANT ALL ON TABLE "public"."post_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."post_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."ratings" TO "anon";
GRANT ALL ON TABLE "public"."ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."ratings" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_prerequisites" TO "anon";
GRANT ALL ON TABLE "public"."recipe_prerequisites" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_prerequisites" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_revisions" TO "anon";
GRANT ALL ON TABLE "public"."recipe_revisions" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_revisions" TO "service_role";



GRANT ALL ON TABLE "public"."recipes" TO "anon";
GRANT ALL ON TABLE "public"."recipes" TO "authenticated";
GRANT ALL ON TABLE "public"."recipes" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."site_config" TO "anon";
GRANT ALL ON TABLE "public"."site_config" TO "authenticated";
GRANT ALL ON TABLE "public"."site_config" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







