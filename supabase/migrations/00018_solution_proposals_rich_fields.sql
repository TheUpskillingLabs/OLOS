-- ROADMAP §2.6 / §3.1 / §3.2 / §3.3 / §3.4 / ISSUE-W2-001 (#74)
-- Rich solution-proposal fields + one-submission-per-cycle constraint.
--
-- Current state: solution_proposals stores submissions as a single
-- `proposal_text TEXT NOT NULL`. W2-001's submission form requires 7 fields
-- (project name, one-line summary, description, plus four optional context
-- fields). Per Open Decision D1 (resolved 2026-05-19): JSONB blob with
-- `name` and `summary` lifted out as top-level columns for indexed lookup
-- and display on voting cards. Mirrors the existing
-- `problem_statements.proposal_data JSONB` precedent (migration 00007).
--
-- New columns are nullable to coexist with 6 legacy test-fixture rows on
-- cycle_id=1 (Spring 2026 Build Cycle, pre-W2-001) whose only payload is
-- the original `proposal_text`. App-layer validation enforces that new
-- submissions provide name/summary/description.
--
-- `proposal_text` drops NOT NULL so new submissions don't need to compose
-- a redundant text version. The 6 legacy rows retain their existing text.
--
-- The (cycle_id, participant_id) unique index enforces the AC rule "one
-- submission per participant per cycle" at the DB layer rather than via
-- racy app-layer checks. Verified no duplicates exist in the legacy rows
-- before authoring (see W2-001 thread, 2026-05-19).

ALTER TABLE solution_proposals
  ADD COLUMN IF NOT EXISTS name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS summary VARCHAR(200),
  ADD COLUMN IF NOT EXISTS proposal_data JSONB;

ALTER TABLE solution_proposals
  ALTER COLUMN proposal_text DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS solution_proposals_one_per_cycle
  ON solution_proposals (cycle_id, participant_id);

COMMENT ON COLUMN solution_proposals.name IS
  'Project name (max 100 chars). Shown on voting cards. Required for W2-001 submissions; NULL for pre-W2-001 legacy rows.';
COMMENT ON COLUMN solution_proposals.summary IS
  'One-line summary (max 200 chars). Shown on voting cards. Required for W2-001 submissions; NULL for pre-W2-001 legacy rows.';
COMMENT ON COLUMN solution_proposals.proposal_data IS
  'Rich proposal payload: description + optional context fields (pod_problem_link, why_now, mvp_scope, skills_wanted). See ISSUE-W2-001.';

-- DOWN: rollback. Forward-only repo policy — copy into a scratch query.
-- DROP INDEX IF EXISTS solution_proposals_one_per_cycle;
-- ALTER TABLE solution_proposals ALTER COLUMN proposal_text SET NOT NULL;
--   -- caution: post-W2-001 rows may have proposal_text NULL; backfill first
-- ALTER TABLE solution_proposals DROP COLUMN IF EXISTS proposal_data;
-- ALTER TABLE solution_proposals DROP COLUMN IF EXISTS summary;
-- ALTER TABLE solution_proposals DROP COLUMN IF EXISTS name;
