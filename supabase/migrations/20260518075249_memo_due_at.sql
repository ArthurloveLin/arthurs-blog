-- Add DDL reminder fields to comments table
ALTER TABLE "public"."comments"
  ADD COLUMN IF NOT EXISTS "due_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "notified_at" timestamp with time zone;

-- Index for efficient reminder polling (only memo notes with due_at set)
CREATE INDEX IF NOT EXISTS "idx_comments_due_at_pending"
  ON "public"."comments" ("due_at")
  WHERE "due_at" IS NOT NULL
    AND "notified_at" IS NULL
    AND "archived" = FALSE
    AND "target_type" = 'memo';
