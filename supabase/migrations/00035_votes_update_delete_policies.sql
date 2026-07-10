-- Pod-layer votes were insert-only: 00002 defined votes_select + votes_insert
-- but no UPDATE or DELETE policy. That made the budget model one-shot per
-- statement — a voter could not re-allocate a vote on a statement they had
-- already voted on (the UNIQUE(voter_id, problem_statement_id, cycle_id)
-- constraint rejects a second INSERT) and had no way to withdraw one.
--
-- Add self-scoped UPDATE + DELETE policies so app/api/votes/route.ts can
-- upsert (INSERT ... ON CONFLICT DO UPDATE) and expose a DELETE. Scope matches
-- votes_insert (voter_id = current_participant_id()); admins do not need to
-- edit individual ballots here. Without these, the DO UPDATE path and the
-- DELETE handler silently affect 0 rows on the cookie-bound client.
--
-- Idempotent: drop-then-create so re-applying across environments is safe.

DROP POLICY IF EXISTS "votes_update" ON votes;
CREATE POLICY "votes_update" ON votes FOR UPDATE TO authenticated
  USING (voter_id = current_participant_id())
  WITH CHECK (voter_id = current_participant_id());

DROP POLICY IF EXISTS "votes_delete" ON votes;
CREATE POLICY "votes_delete" ON votes FOR DELETE TO authenticated
  USING (voter_id = current_participant_id());
