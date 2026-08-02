-- #313 full-test decision O2 (owner, 2026-08-01; docs/testing/pr-313-findings.md)
--
-- Re-revocations must write a fresh audit row. The 00030 idempotency index
-- blocked the second missed_logs row for a member who was revoked, reactivated,
-- and revoked again, so the audit trail ended on "reactivated" while the
-- enrollment was actually inactive — the trail misled exactly when it mattered.
--
-- The uniqueness guard is no longer needed for its original purpose: under the
-- registered/active model both revocation paths (cron stage 2, admin sweep)
-- insert only on the status='active' → 'inactive' transition, and a revoked
-- member leaves the status='active' pool the routes iterate, so a retry or
-- double-run has nothing to re-insert. The residual risk is two concurrent
-- runs racing the same transition; a duplicate audit row in that case is
-- honest (two triggers fired) and harmless.
--
-- The routes' 23505-swallowing goes away in the same commit: with no unique
-- index a 23505 can't occur, and any other insert error is now logged loudly.

DROP INDEX IF EXISTS idx_access_revocations_unique_full;

-- Keep the lookup fast without the uniqueness.
CREATE INDEX IF NOT EXISTS idx_access_revocations_participant_cycle
  ON access_revocations (participant_id, cycle_id);

-- DOWN (manual rollback — forward-only repo policy):
-- DROP INDEX IF EXISTS idx_access_revocations_participant_cycle;
-- CREATE UNIQUE INDEX idx_access_revocations_unique_full
--   ON access_revocations (participant_id, cycle_id, reason)
--   WHERE revocation_scope = 'full' AND reason <> 'reactivated';
