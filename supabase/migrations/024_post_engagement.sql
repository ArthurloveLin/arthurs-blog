ALTER TABLE posts
ADD COLUMN IF NOT EXISTS upvotes integer DEFAULT 0;

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS downvotes integer DEFAULT 0;

UPDATE posts
SET upvotes = COALESCE(upvotes, 0),
    downvotes = COALESCE(downvotes, 0)
WHERE upvotes IS NULL
   OR downvotes IS NULL;

ALTER TABLE posts
ALTER COLUMN upvotes SET DEFAULT 0;

ALTER TABLE posts
ALTER COLUMN downvotes SET DEFAULT 0;

ALTER TABLE posts
ALTER COLUMN upvotes SET NOT NULL;

ALTER TABLE posts
ALTER COLUMN downvotes SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'posts_upvotes_nonnegative_check'
  ) THEN
    ALTER TABLE posts
    ADD CONSTRAINT posts_upvotes_nonnegative_check CHECK (upvotes >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'posts_downvotes_nonnegative_check'
  ) THEN
    ALTER TABLE posts
    ADD CONSTRAINT posts_downvotes_nonnegative_check CHECK (downvotes >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  identity text NOT NULL,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, identity)
);

CREATE INDEX IF NOT EXISTS idx_post_reactions_post_id
ON post_reactions (post_id);

CREATE INDEX IF NOT EXISTS idx_post_reactions_identity
ON post_reactions (identity);

CREATE OR REPLACE FUNCTION update_post_reactions_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS post_reactions_updated_at ON post_reactions;

CREATE TRIGGER post_reactions_updated_at
BEFORE UPDATE ON post_reactions
FOR EACH ROW EXECUTE PROCEDURE update_post_reactions_updated_at();

CREATE TABLE IF NOT EXISTS post_emoji_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  identity text NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, identity, emoji)
);

CREATE INDEX IF NOT EXISTS idx_post_emoji_reactions_post_id
ON post_emoji_reactions (post_id);

CREATE INDEX IF NOT EXISTS idx_post_emoji_reactions_identity
ON post_emoji_reactions (identity);

CREATE OR REPLACE FUNCTION update_post_emoji_reactions_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS post_emoji_reactions_updated_at ON post_emoji_reactions;

CREATE TRIGGER post_emoji_reactions_updated_at
BEFORE UPDATE ON post_emoji_reactions
FOR EACH ROW EXECUTE PROCEDURE update_post_emoji_reactions_updated_at();