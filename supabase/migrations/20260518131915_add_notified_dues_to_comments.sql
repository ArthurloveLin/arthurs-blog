ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS notified_dues JSONB NOT NULL DEFAULT '[]'::jsonb;
