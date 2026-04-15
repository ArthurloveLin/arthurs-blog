CREATE TABLE IF NOT EXISTS comment_emoji_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  identity text NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, identity)
);

CREATE INDEX IF NOT EXISTS idx_comment_emoji_reactions_comment_id
ON comment_emoji_reactions (comment_id);

CREATE INDEX IF NOT EXISTS idx_comment_emoji_reactions_identity
ON comment_emoji_reactions (identity);

CREATE OR REPLACE FUNCTION update_comment_emoji_reactions_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS comment_emoji_reactions_updated_at ON comment_emoji_reactions;

CREATE TRIGGER comment_emoji_reactions_updated_at
BEFORE UPDATE ON comment_emoji_reactions
FOR EACH ROW EXECUTE PROCEDURE update_comment_emoji_reactions_updated_at();