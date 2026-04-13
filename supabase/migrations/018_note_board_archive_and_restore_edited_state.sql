ALTER TABLE comments
ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;

UPDATE comments
SET archived = false
WHERE archived IS NULL;

ALTER TABLE comments
ALTER COLUMN archived SET DEFAULT false;

ALTER TABLE comments
ALTER COLUMN archived SET NOT NULL;

UPDATE comments
SET updated_at = created_at
WHERE parent_id IS NULL
  AND target_type IN ('guestbook', 'memo')
  AND target_id IN (
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002'
  )
  AND updated_at IS NOT NULL
  AND created_at IS NOT NULL
  AND updated_at > created_at;