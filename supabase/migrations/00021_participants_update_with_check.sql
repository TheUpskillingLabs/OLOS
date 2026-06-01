-- ROADMAP §3.7 / ISSUE #110 / Phase A
--
-- Add WITH CHECK clause to participants_update_own, mirroring the defense-
-- in-depth pattern migration 00019 applied to solution_proposals_update.
--
-- Without WITH CHECK, USING gates only the row being targeted at access
-- time; Postgres does not re-evaluate the policy against the post-update
-- row. A participant could theoretically UPDATE their own row to set
-- auth_user_id to NULL or to another user's UUID, breaking the identity
-- linkage that the rest of the system depends on. WITH CHECK on the same
-- predicate forces the resulting row to also satisfy the policy, closing
-- the loophole.
--
-- Reference: Postgres docs on CREATE POLICY USING vs WITH CHECK
-- https://www.postgresql.org/docs/current/sql-createpolicy.html

DROP POLICY IF EXISTS "participants_update_own" ON participants;

CREATE POLICY "participants_update_own" ON participants FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() OR is_admin_or_owner())
  WITH CHECK (auth_user_id = auth.uid() OR is_admin_or_owner());

-- DOWN (manual rollback — forward-only repo policy):
-- DROP POLICY IF EXISTS "participants_update_own" ON participants;
-- CREATE POLICY "participants_update_own" ON participants FOR UPDATE TO authenticated
--   USING (auth_user_id = auth.uid() OR is_admin_or_owner());
