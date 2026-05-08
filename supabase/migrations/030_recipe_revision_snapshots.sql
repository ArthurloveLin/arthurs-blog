ALTER TABLE recipe_revisions
ADD COLUMN IF NOT EXISTS snapshot jsonb;