CREATE TABLE memo_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  due_at TIMESTAMPTZ NOT NULL,
  repeat_mode TEXT NOT NULL DEFAULT 'once',
  repeat_days INTEGER[] NULL,
  notified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX memo_reminders_memo_idx ON memo_reminders (memo_id);
-- Partial index covers the common polling query: due_at <= now AND notified_at IS NULL
CREATE INDEX memo_reminders_due_idx ON memo_reminders (due_at) WHERE notified_at IS NULL;
