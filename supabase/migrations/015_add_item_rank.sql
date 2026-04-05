-- Add rank column to items table
-- 1: Champion, 2: Runner-up, 3: Third Place
ALTER TABLE items ADD COLUMN IF NOT EXISTS rank integer;

-- Update RLS if needed (usually columns are covered by table-level RLS)
COMMENT ON COLUMN items.rank IS 'Ranking from tournament (1=Gold, 2=Silver, 3=Bronze)';

-- 1. 基础表结构补全 (如果缺失)
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  summary text,
  tags text[] DEFAULT '{}',
  r2_key text NOT NULL,
  published boolean DEFAULT false,
  published_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  category text,
  cover_image text
);

CREATE TABLE IF NOT EXISTS site_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id)
);

-- 2. items 字段补全 (核心对决与属性)
ALTER TABLE items ADD COLUMN IF NOT EXISTS price integer;
ALTER TABLE items ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE items ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE items ADD COLUMN IF NOT EXISTS rank integer; -- 2选1排名支持
COMMENT ON COLUMN items.rank IS '对决排名 (1=金, 2=银, 3=铜)';

-- 3. ratings & sessions 字段补全
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS appearance_score numeric(2,1);
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS practicality_score numeric(2,1);
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS value_score numeric(2,1);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false NOT NULL;

-- 4. 通用评论系统补全
ALTER TABLE comments ADD COLUMN IF NOT EXISTS target_type text NOT NULL DEFAULT 'wardrobe_item';
ALTER TABLE comments ADD COLUMN IF NOT EXISTS target_id uuid;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES comments(id) ON DELETE CASCADE;

-- 5. 资料卡 (site_config) 初始键位补全
-- 只有键位存在，后台 SiteSettingsForm 才能正常显示和更新这些内容
INSERT INTO site_config (key, value) VALUES
  ('author_name', 'Arthur & Grace'),
  ('author_bio', '技术、生活与创意的记录者'),
  ('author_role', 'Full-stack Developer'),
  ('author_company', 'Tech Studio'),
  ('author_location', 'China'),
  ('author_skills', 'TypeScript, Next.js, Tailwind, Supabase'),
  ('author_status', '工作中'),
  ('author_github', ''),
  ('author_weibo', ''),
  ('author_wechat', ''),
  ('author_email', ''),
  ('site_subtitle', 'Arthur & Grace · Journal'),
  ('site_title_highlight', '技术、生活与创意'),
  ('site_description', '探索编程、设计与选衣搭配的见解')
ON CONFLICT (key) DO NOTHING;

-- 6. 开启 RLS 并配置基础策略 (确保 Admin 可写)
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon can read" ON site_config;
CREATE POLICY "anon can read" ON site_config FOR SELECT USING (true);

-- 允许 Service Role (API端) 写入，或根据需要添加 Admin 修改策略
