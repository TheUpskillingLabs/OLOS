-- ROADMAP §3.7 / ISSUE #110 Phase C / Architecture review broken edges #10, #11
--
-- Two changes that together make the revocation cron safe to re-enable:
--
-- 1. Warning state on cycle_enrollments (architecture review broken edge #10).
--    The redesigned cron is a two-stage handler: send a warning email and
--    set `warned_at` first; then on a later tick, if the participant is
--    still eligible for revocation AND warned_at + 3 days <= now(), revoke.
--    This gives a 3-day grace period after the warning before any
--    revocation fires. `warning_reason` distinguishes 'missed_pulses' from
--    future reasons ('not_in_pod', etc.) without overloading one column.
--
-- 2. Idempotent access_revocations writes (architecture review broken edge #11).
--    Unique partial index on (participant_id, cycle_id, reason) WHERE
--    revocation_scope='full'. Without this, a cron retry / double-run could
--    insert duplicate revocation rows. The partial scope clause keeps the
--    constraint narrow: future non-full revocations (e.g. partial scope for
--    a specific subsystem) aren't blocked from re-running.
--
-- Design note — warnings as columns, not a table
-- -----------------------------------------------
-- We considered two shapes for the warning state:
--   (A, chosen): `warned_at` + `warning_reason` columns on cycle_enrollments
--   (B):         A separate `enrollment_warnings` table with full history
--
-- Option A is sufficient for the current use case: one warning type
-- (missed_pulses), at most one active warning per enrollment, cron volume
-- is low. The architecture brief's audit precedent (access_revocations) only
-- logs completed revocations; warnings that resolve via recovery leave no
-- historical row. That trade-off is accepted for now and documented in
-- roadmap §3.7's Phase C section.
--
-- Migration A → B is cheap if the use case evolves: INSERT one row per
-- existing warned_at value into the new table, drop these columns. The
-- triggers to revisit are: (1) a second warning type ships, OR (2) a
-- program manager asks for warning-history reports across cycles, OR (3)
-- compliance becomes a documented organizational need.
--
-- Design note — idempotency mechanism
-- ------------------------------------
-- The cron's email-send idempotency is state-driven via `warned_at`: if
-- the column is set and warned_at + grace_period > now(), the warning is
-- still active — don't re-warn. No separate `cron_runs` ledger needed.
-- The unique partial index below provides DB-enforced idempotency for the
-- final revocation step so that a retry can use INSERT ... ON CONFLICT
-- DO NOTHING and not duplicate rows.
--
-- The pulse-check-reminder cron at app/api/cron/pulse-check-reminder/
-- route.ts has a related but separate idempotency gap (no DB-backed
-- per-send tracking; in-run Set<number> dedup only). Tracked as a
-- follow-up; out of scope for Phase C.

ALTER TABLE cycle_enrollments
  ADD COLUMN IF NOT EXISTS warned_at      TIMESTAMP,
  ADD COLUMN IF NOT EXISTS warning_reason VARCHAR(100);

COMMENT ON COLUMN cycle_enrollments.warned_at IS
  'Set when the revocation cron sends a warning email. Cleared (or stays set, then ignored) when the participant recovers. Acts as the email-idempotency state for the warning stage of the two-stage revocation cron.';
COMMENT ON COLUMN cycle_enrollments.warning_reason IS
  'Reason identifier matching the cron''s revocation rules. v1 values: ''missed_pulses''. Future values may include ''not_in_pod''. Mirrors the convention in access_revocations.reason.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_access_revocations_unique_full
  ON access_revocations (participant_id, cycle_id, reason)
  WHERE revocation_scope = 'full';

COMMENT ON INDEX idx_access_revocations_unique_full IS
  'Idempotency guard for the revocation cron. Allows INSERT ... ON CONFLICT DO NOTHING to safely retry without producing duplicate revocation rows for the same (participant, cycle, reason). Partial on revocation_scope = ''full'' so future non-full scopes (per-subsystem) can write multiple rows for the same participant.';

-- DOWN (manual rollback — forward-only repo policy):
-- DROP INDEX IF EXISTS idx_access_revocations_unique_full;
-- ALTER TABLE cycle_enrollments
--   DROP COLUMN IF EXISTS warning_reason,
--   DROP COLUMN IF EXISTS warned_at;
