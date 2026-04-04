-- 013_rls_policies.sql
-- Phase 5: Row Level Security policies

-- ── Enable RLS ────────────────────────────────────────────────
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- ── Helper: check admin role ──────────────────────────────────
-- Used inline to avoid creating a security-definer function dependency

-- ── comments ─────────────────────────────────────────────────
-- Anyone (anon / authenticated) can read comments
CREATE POLICY "comments_select_all"
  ON comments FOR SELECT
  USING (true);

-- INSERT is handled exclusively by the server-side API (service role key),
-- which bypasses RLS — no direct-client insert policy needed.

-- DELETE: admin can delete any comment; guest/user delete is enforced
-- at the API layer (identity check in /api/comments/[id]/route.ts),
-- so we only need the admin shortcut here.
CREATE POLICY "comments_delete_admin"
  ON comments FOR DELETE
  USING (
    auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
  );

-- ── items ─────────────────────────────────────────────────────
-- Anyone can read items
CREATE POLICY "items_select_all"
  ON items FOR SELECT
  USING (true);

-- Write ops (INSERT / UPDATE / DELETE) admin only
CREATE POLICY "items_insert_admin"
  ON items FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
  );

CREATE POLICY "items_update_admin"
  ON items FOR UPDATE
  USING (
    auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
  );

CREATE POLICY "items_delete_admin"
  ON items FOR DELETE
  USING (
    auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
  );

-- ── sessions ──────────────────────────────────────────────────
-- Anyone can read sessions (public session pages)
CREATE POLICY "sessions_select_all"
  ON sessions FOR SELECT
  USING (true);

-- Write ops (INSERT / UPDATE / DELETE) admin only
CREATE POLICY "sessions_insert_admin"
  ON sessions FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
  );

CREATE POLICY "sessions_update_admin"
  ON sessions FOR UPDATE
  USING (
    auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
  );

CREATE POLICY "sessions_delete_admin"
  ON sessions FOR DELETE
  USING (
    auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
  );
