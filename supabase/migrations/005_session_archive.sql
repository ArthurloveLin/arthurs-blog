-- Phase 5: 会话归档
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false NOT NULL;
