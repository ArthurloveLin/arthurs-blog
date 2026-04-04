-- 012_comments_universal.sql
-- Phase 3: Universal comments module

-- Add target_type column (default 'wardrobe_item' for backward compat)
ALTER TABLE comments ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT 'wardrobe_item';

-- Add target_id column (UUID, initially nullable so we can backfill)
ALTER TABLE comments ADD COLUMN IF NOT EXISTS target_id UUID;

-- Backfill target_id from item_id for all existing comments
UPDATE comments SET target_id = item_id WHERE target_id IS NULL AND item_id IS NOT NULL;

-- Now enforce NOT NULL on target_id
ALTER TABLE comments ALTER COLUMN target_id SET NOT NULL;

-- Composite index for querying by target
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments (target_type, target_id);
