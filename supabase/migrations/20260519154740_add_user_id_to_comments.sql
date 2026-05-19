-- Add per-user ownership to memo notes.
-- user_id references the Supabase auth user who created the note.
-- NULL for legacy rows and guestbook entries (public board, no owner).
ALTER TABLE "public"."comments"
  ADD COLUMN IF NOT EXISTS "user_id" uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for per-user memo queries (the dominant access pattern after this migration)
CREATE INDEX IF NOT EXISTS "idx_comments_memo_user_id"
  ON "public"."comments" ("target_type", "user_id")
  WHERE "target_type" = 'memo';
