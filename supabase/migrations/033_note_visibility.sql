-- Add visibility column to comments table for note-board privacy control.
-- Only 'memo' board notes use this in practice; guestbook notes stay 'public'.
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

-- Ensure existing rows are explicitly marked public.
UPDATE comments SET visibility = 'public' WHERE visibility != 'public';
