-- ROADMAP §3.7 / ISSUE #110 / Phase A
--
-- Tighten pod_memberships_select to honor the soft-delete invariant.
--
-- The original policy from 00002:105 used USING (true), exposing every
-- pod_memberships row including those with inactive_at IS NOT NULL to
-- every authenticated user. The architecture review at
-- docs/architecture-review-onboarding-state-machine.md (broken edge #18)
-- identified this as a soft-delete leak: a participant who leaves a pod
-- is still visible to other participants in that pod's membership join,
-- and former members can see currently-active members of pods they no
-- longer belong to.
--
-- New predicate: a row is visible when ANY of
--   - the membership is currently active (inactive_at IS NULL), OR
--   - the viewer is the participant whose membership it is (own history
--     stays readable for self-service purposes), OR
--   - the viewer is admin/owner (full audit access).
--
-- Active-row visibility is preserved unchanged, so 00020's
-- participants_select_visible policy (which joins pod_memberships in
-- both directions) keeps working for cross-pod-mate name lookups on
-- the moderator pod-detail page.

DROP POLICY IF EXISTS "pod_memberships_select" ON pod_memberships;

CREATE POLICY "pod_memberships_select" ON pod_memberships FOR SELECT TO authenticated
  USING (
    inactive_at IS NULL
    OR participant_id = current_participant_id()
    OR is_admin_or_owner()
  );

-- DOWN (manual rollback — forward-only repo policy):
-- DROP POLICY IF EXISTS "pod_memberships_select" ON pod_memberships;
-- CREATE POLICY "pod_memberships_select" ON pod_memberships FOR SELECT TO authenticated
--   USING (true);
