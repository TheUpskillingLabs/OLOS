-- Project-layer votes were insert-only (project_votes_select + project_votes_insert
-- from 00002, no UPDATE/DELETE). The project ballot is being converged onto the
-- pod-vote model: live tallies, incremental per-proposal allocation, and the
-- ability to change or withdraw a vote until the window closes. That needs the
-- same self-scoped UPDATE + DELETE policies the pod `votes` table got in 00035,
-- or the upsert's DO UPDATE path and the DELETE handler silently affect 0 rows
-- on the cookie-bound client.
--
-- Idempotent: drop-then-create so re-applying across environments is safe.

DROP POLICY IF EXISTS "project_votes_update" ON project_votes;
CREATE POLICY "project_votes_update" ON project_votes FOR UPDATE TO authenticated
  USING (voter_id = current_participant_id())
  WITH CHECK (voter_id = current_participant_id());

DROP POLICY IF EXISTS "project_votes_delete" ON project_votes;
CREATE POLICY "project_votes_delete" ON project_votes FOR DELETE TO authenticated
  USING (voter_id = current_participant_id());
