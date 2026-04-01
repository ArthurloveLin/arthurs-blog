-- Phase 3 additions

-- 衣服价格（元）
ALTER TABLE items ADD COLUMN IF NOT EXISTS price integer;

-- 评论回复（楼中楼），null 表示顶层评论
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES comments(id) ON DELETE CASCADE;
