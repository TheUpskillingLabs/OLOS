-- Allow participants to see other participants who share an active pod with them.
--
-- Existing policy (`participants_select_own` from 00002):
--   USING ((auth_user_id = auth.uid()) OR is_admin_or_owner())
--
-- This locked every regular participant to seeing ONLY their own row. The
-- moderator pod-detail page joins `pod_memberships → participants` to render
-- names; under that policy the join returned NULL for everyone except the
-- viewer, producing rows-with-blank-names in the members table.
--
-- This migration replaces the policy with a broader (but still scoped) one:
-- a participant can SELECT another participant's row iff they share an
-- ACTIVE pod_membership. Cross-pod isolation is preserved — Pod-5 members
-- still cannot see Pod-8 members unless someone is in both.
--
-- Soft-delete is honored: a participant whose membership has
-- `inactive_at IS NOT NULL` is not considered a current pod-mate.
--
-- Admins/owners retain global access via `is_admin_or_owner()`.

DROP POLICY IF EXISTS "participants_select_own" ON participants;

CREATE POLICY "participants_select_visible" ON participants FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR is_admin_or_owner()
    OR EXISTS (
      SELECT 1
      FROM pod_memberships pm_self
      JOIN pod_memberships pm_other
        ON pm_other.pod_id = pm_self.pod_id
      WHERE pm_self.participant_id = current_participant_id()
        AND pm_other.participant_id = participants.id
        AND pm_self.inactive_at IS NULL
        AND pm_other.inactive_at IS NULL
    )
  );

-- DOWN (manual rollback — forward-only repo policy):
-- DROP POLICY IF EXISTS "participants_select_visible" ON participants;
-- CREATE POLICY "participants_select_own" ON participants FOR SELECT TO authenticated
--   USING ((auth_user_id = auth.uid()) OR is_admin_or_owner());
