-- ── recipes: 主表 ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipes (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text        UNIQUE NOT NULL,
  title            text        NOT NULL,
  description      text,
  cover_image      text,                       -- R2 public URL
  cover_image_key  text,                       -- R2 object key for deletion
  category         text,
  version          text        NOT NULL DEFAULT '1.0',

  -- 量化指标
  prep_time_minutes  int,
  cook_time_minutes  int,
  servings           int,

  -- 风味雷达（0-5，null=未设置）
  flavor_sour      smallint    CHECK (flavor_sour    BETWEEN 0 AND 5),
  flavor_sweet     smallint    CHECK (flavor_sweet   BETWEEN 0 AND 5),
  flavor_bitter    smallint    CHECK (flavor_bitter  BETWEEN 0 AND 5),
  flavor_spicy     smallint    CHECK (flavor_spicy   BETWEEN 0 AND 5),
  flavor_umami     smallint    CHECK (flavor_umami   BETWEEN 0 AND 5),
  flavor_aromatic  smallint    CHECK (flavor_aromatic BETWEEN 0 AND 5),

  -- 技能与标签
  proficiency      smallint    CHECK (proficiency BETWEEN 1 AND 5),
  tags             text[]      DEFAULT '{}',
  suitable_occasions text[]    DEFAULT '{}',
  failure_notes    text,
  life_notes       text,
  pairing_suggestions text,

  -- 结构化内容（JSONB，前端可增删排序）
  -- ingredients schema: [{id: string, amount: string, unit: string, name: string, note: string}]
  -- steps schema:       [{id: string, order: int, title: string, description: string, tip: string}]
  ingredients      jsonb       NOT NULL DEFAULT '[]',
  steps            jsonb       NOT NULL DEFAULT '[]',

  -- 发布状态
  published        boolean     NOT NULL DEFAULT false,
  published_at     timestamptz,

  -- 排序权重
  sort_order       int         NOT NULL DEFAULT 0,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipes_slug       ON recipes (slug);
CREATE INDEX IF NOT EXISTS idx_recipes_published  ON recipes (published, sort_order);
CREATE INDEX IF NOT EXISTS idx_recipes_category   ON recipes (category) WHERE category IS NOT NULL;

-- ── recipe_revisions: 版本修订记录 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipe_revisions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id   uuid        NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  version     text        NOT NULL,
  change_summary text     NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipe_revisions_recipe_id
  ON recipe_revisions (recipe_id, created_at DESC);

-- ── recipe_prerequisites: 前置技能有向图 ─────────────────────────────────────
-- from_recipe_id → to_recipe_id 表示"学会 from 之后才能学 to"
CREATE TABLE IF NOT EXISTS recipe_prerequisites (
  id             uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  from_recipe_id uuid  NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  to_recipe_id   uuid  NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  skill_label    text  NOT NULL,
  UNIQUE (from_recipe_id, to_recipe_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_prereqs_from ON recipe_prerequisites (from_recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_prereqs_to   ON recipe_prerequisites (to_recipe_id);

-- ── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_recipes_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS recipes_updated_at ON recipes;
CREATE TRIGGER recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE PROCEDURE update_recipes_updated_at();

-- ── Row-Level Security ───────────────────────────────────────────────────────
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_prerequisites ENABLE ROW LEVEL SECURITY;

-- Public read for published recipes
CREATE POLICY "recipes_published_select"
  ON recipes FOR SELECT
  USING (published = true);

-- Admin full access (insert / update / delete)
CREATE POLICY "recipes_admin_all"
  ON recipes
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Revisions: readable if parent recipe is published; admin can write
CREATE POLICY "recipe_revisions_select"
  ON recipe_revisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE id = recipe_id AND published = true
    )
  );

CREATE POLICY "recipe_revisions_admin_all"
  ON recipe_revisions
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Prerequisites: same visibility as recipes
CREATE POLICY "recipe_prereqs_select"
  ON recipe_prerequisites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE id = from_recipe_id AND published = true
    )
  );

CREATE POLICY "recipe_prereqs_admin_all"
  ON recipe_prerequisites
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
