-- 00092_enrollment_registered_status.sql
--
-- Splits cycle_enrollments.status into a MEMBERSHIP axis and a POD-ACTIVATION
-- axis by adding a positive pre-pod state, 'registered'.
--
-- Before this change, self-service registration wrote 'inactive' and the
-- reconciler (lib/enrollment/reconciler.ts) only flipped it to 'active' once
-- the participant held an active pod membership. So every registrant read as
-- 'inactive' until pods formed — they couldn't log, didn't show as a
-- participant, and the admin roster flagged the whole pre-pod cohort as
-- "stuck". The new model:
--
--   registered  committed member, no active pod yet  (self-service resting
--               state; grants the participant role and can log)
--   active      committed member WITH an active pod  (meaning unchanged)
--   inactive    the only true exit: was active, fell behind the weekly logs
--               (always carries an access_revocations audit row)
--   revoked     hard erasure / archive (lib/owner/archive.ts), unchanged
--
-- The reconciler now only manages registered <-> active; it never writes
-- 'inactive'. 'inactive' is written solely by the engagement paths (cron /
-- admin sweep), which also write the access_revocations audit row.
--
-- 00056 already extended the CHECK to add 'interested'/'completed'; this
-- keeps that full vocabulary and adds 'registered'.
--
-- DOWN:
--   ALTER TABLE cycle_enrollments ALTER COLUMN status SET DEFAULT 'inactive';
--   UPDATE cycle_enrollments SET status = 'inactive' WHERE status = 'registered';
--   ALTER TABLE cycle_enrollments DROP CONSTRAINT IF EXISTS cycle_enrollments_status_check;
--   ALTER TABLE cycle_enrollments ADD CONSTRAINT cycle_enrollments_status_check
--     CHECK (status IN ('interested','active','inactive','revoked','stepped_back','completed')) NOT VALID;

-- 1. Extend the vocabulary with 'registered'.
ALTER TABLE cycle_enrollments DROP CONSTRAINT IF EXISTS cycle_enrollments_status_check;
ALTER TABLE cycle_enrollments ADD CONSTRAINT cycle_enrollments_status_check
  CHECK (status IN ('registered','interested','active','inactive','revoked','stepped_back','completed'));
-- ⚠ Verify no out-of-vocabulary values exist before promoting to prod:
--   SELECT DISTINCT status FROM cycle_enrollments;

-- 2. Backfill: every 'inactive' row that is NOT a genuine engagement exit
--    becomes 'registered'. An engagement exit is distinguished by an
--    access_revocations audit row for the (participant, cycle). This sweeps
--    up both pre-pod never-activated rows AND old "left a pod" demotions
--    (which the pre-00092 reconciler wrote as 'inactive' without an audit
--    row) — under the new model both are 'registered'. Genuine revocations
--    (audit row present) stay 'inactive'.
UPDATE cycle_enrollments ce
   SET status = 'registered',
       inactive_date = NULL
 WHERE ce.status = 'inactive'
   AND NOT EXISTS (
     SELECT 1 FROM access_revocations ar
      WHERE ar.participant_id = ce.participant_id
        AND ar.cycle_id = ce.cycle_id
   );

-- 3. New self-service resting state is the default (was 'inactive').
ALTER TABLE cycle_enrollments ALTER COLUMN status SET DEFAULT 'registered';

-- 4. The constraint was created VALID above (all existing rows now conform),
--    so no separate VALIDATE step is required.
