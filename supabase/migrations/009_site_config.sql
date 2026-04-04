-- 改动项2：站点配置表（作者信息动态化）
CREATE TABLE site_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- RLS：anon 可读，service_role 可写（默认拥有全部权限）
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon can read" ON site_config FOR SELECT USING (true);

-- 初始数据
INSERT INTO site_config (key, value) VALUES
  ('author_name',       'Arthur & Grace'),
  ('author_bio',        '技术、生活与创意的记录者'),
  ('author_avatar_url', '');
