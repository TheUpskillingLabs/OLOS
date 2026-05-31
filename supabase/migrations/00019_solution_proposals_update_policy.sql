-- Allow participants to update their own solution proposals.
-- The INSERT policy (00002) covers initial submission; upsert-on-edit
-- also needs an UPDATE policy or RLS blocks the conflict-resolution path.
--
-- USING gates which existing rows the user can target for UPDATE.
-- WITH CHECK gates what the row may look like AFTER the update — prevents
-- a participant from reassigning `participant_id` to another participant's
-- value mid-update. Pairing both is the canonical pattern for UPDATE
-- policies (Postgres docs + Supabase RLS guide).
CREATE POLICY "solution_proposals_update" ON solution_proposals FOR UPDATE TO authenticated
  USING (participant_id = current_participant_id())
  WITH CHECK (participant_id = current_participant_id());
