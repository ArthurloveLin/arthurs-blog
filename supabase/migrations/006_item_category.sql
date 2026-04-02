-- Phase 5: 会话内分组 / 标签
ALTER TABLE items ADD COLUMN IF NOT EXISTS category text;
