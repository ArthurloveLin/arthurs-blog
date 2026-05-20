-- Allow authenticated users to insert their own memo notes
CREATE POLICY "memo_insert_own" ON "public"."comments"
  FOR INSERT TO authenticated
  WITH CHECK (target_type = 'memo' AND user_id = auth.uid());

-- Allow authenticated users to update their own memo notes
CREATE POLICY "memo_update_own" ON "public"."comments"
  FOR UPDATE TO authenticated
  USING  (target_type = 'memo' AND user_id = auth.uid())
  WITH CHECK (target_type = 'memo' AND user_id = auth.uid());

-- Allow authenticated users to delete their own memo notes
-- (coexists with existing comments_delete_admin policy via OR logic)
CREATE POLICY "memo_delete_own" ON "public"."comments"
  FOR DELETE TO authenticated
  USING (target_type = 'memo' AND user_id = auth.uid());
