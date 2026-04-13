ALTER TABLE comments
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE comments
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

ALTER TABLE comments
ALTER COLUMN updated_at SET DEFAULT now();

CREATE OR REPLACE FUNCTION update_comments_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS comments_updated_at ON comments;

CREATE TRIGGER comments_updated_at
BEFORE UPDATE ON comments
FOR EACH ROW EXECUTE PROCEDURE update_comments_updated_at();
