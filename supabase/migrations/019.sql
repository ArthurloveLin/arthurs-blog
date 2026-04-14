ALTER TABLE comments
ADD COLUMN IF NOT EXISTS priority smallint DEFAULT 1;

UPDATE comments
SET priority = 1
WHERE priority IS NULL;

ALTER TABLE comments
ALTER COLUMN priority SET DEFAULT 1;

ALTER TABLE comments
ALTER COLUMN priority SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comments_priority_range_check'
  ) THEN
    ALTER TABLE comments
    ADD CONSTRAINT comments_priority_range_check CHECK (priority BETWEEN 0 AND 2);
  END IF;
END $$;