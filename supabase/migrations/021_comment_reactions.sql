ALTER TABLE comments
ADD COLUMN IF NOT EXISTS upvotes integer DEFAULT 0;

ALTER TABLE comments
ADD COLUMN IF NOT EXISTS downvotes integer DEFAULT 0;

UPDATE comments
SET upvotes = COALESCE(upvotes, 0),
    downvotes = COALESCE(downvotes, 0)
WHERE upvotes IS NULL
   OR downvotes IS NULL;

ALTER TABLE comments
ALTER COLUMN upvotes SET DEFAULT 0;

ALTER TABLE comments
ALTER COLUMN downvotes SET DEFAULT 0;

ALTER TABLE comments
ALTER COLUMN upvotes SET NOT NULL;

ALTER TABLE comments
ALTER COLUMN downvotes SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comments_upvotes_nonnegative_check'
  ) THEN
    ALTER TABLE comments
    ADD CONSTRAINT comments_upvotes_nonnegative_check CHECK (upvotes >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comments_downvotes_nonnegative_check'
  ) THEN
    ALTER TABLE comments
    ADD CONSTRAINT comments_downvotes_nonnegative_check CHECK (downvotes >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  identity text NOT NULL,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, identity)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id
ON comment_reactions (comment_id);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_identity
ON comment_reactions (identity);

CREATE OR REPLACE FUNCTION update_comment_reactions_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_comments_updated_at()
RETURNS trigger AS $$
BEGIN
  IF ROW(
    NEW.author,
    NEW.content,
    NEW.parent_id,
    NEW.target_type,
    NEW.target_id,
    NEW.archived,
    NEW.priority
  ) IS DISTINCT FROM ROW(
    OLD.author,
    OLD.content,
    OLD.parent_id,
    OLD.target_type,
    OLD.target_id,
    OLD.archived,
    OLD.priority
  ) THEN
    NEW.updated_at = now();
  ELSE
    NEW.updated_at = OLD.updated_at;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS comment_reactions_updated_at ON comment_reactions;

CREATE TRIGGER comment_reactions_updated_at
BEFORE UPDATE ON comment_reactions
FOR EACH ROW EXECUTE PROCEDURE update_comment_reactions_updated_at();