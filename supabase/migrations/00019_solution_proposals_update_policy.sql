-- Allow participants to update their own solution proposals.
-- The INSERT policy (00002) covers initial submission; upsert-on-edit
-- also needs an UPDATE policy or RLS blocks the conflict-resolution path.
CREATE POLICY "solution_proposals_update" ON solution_proposals FOR UPDATE TO authenticated
  USING (participant_id = current_participant_id());
