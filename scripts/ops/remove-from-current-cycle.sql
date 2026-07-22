-- =============================================================================
-- remove-from-current-cycle.sql — Deactivate specific people in the current
--                                 build cycle, but keep them as upskillers
-- =============================================================================
--
-- Purpose
-- -------
-- Take four named people OUT of the current build cycle (no longer active
-- participants in it) while leaving their upskiller identity fully intact:
-- their participants row, roles, and account are never touched, and their
-- cycle_enrollments row is kept (flipped to 'inactive') so history survives
-- and they can be reactivated later.
--
-- Targets (matched case-insensitively on participants.email):
--   * sandra@upskillinglabs.org
--   * jennaschmidt08@gmail.com
--   * amg@withlevy.com
--   * mayturose5@gmail.com
--
-- "Current build cycle"
-- ---------------------
-- The running participant cohort, resolved exactly as the app does in
-- lib/cycle/active.ts::getOperatingCycle — status='active', mode='open',
-- lab_id IS NULL (the single HQ open stream; labs are sub-cohorts of it,
-- migration 00067). The pre-flight aborts unless exactly one such cycle
-- exists, so we never guess.
--
-- What it does (mirrors app/api/revocations/check/[cycle_id]/route.ts,
-- the canonical admin "remove from cycle" path)
-- --------------------------------------------------------------------
--   1. pod_memberships     — soft-delete (inactive_at = now) for the
--                            target's memberships whose pod is in this cycle
--   2. project_memberships — soft-delete (left_at = now) for this cycle
--   3. cycle_enrollments   — status -> 'inactive', inactive_date = now
--                            (row kept, NOT deleted)
--   4. access_revocations  — one audit row per person (scope 'full')
--
-- What it INTENTIONALLY leaves alone (this is what "leave as upskillers" means)
-- ----------------------------------------------------------------------------
--   participants           row, profile, handle — untouched
--   participant_roles      upskiller/member and any other roles — untouched
--   user_roles / auth.users                                     — untouched
--   cycle_enrollments      the ROW stays (only status/inactive_date change),
--                          so they remain a known, reactivatable member
--   their submissions      problem_statements / solution_proposals / votes —
--                          left as historical record (matches the app path,
--                          which only revokes access, never deletes work)
--
-- Two-pass dry-run pattern (same contract as reset-energy-participants.sql)
-- ------------------------------------------------------------------------
-- This script ends with `ROLLBACK` by default. Run it once to read the
-- before/after report, sanity-check the numbers, then:
--   1. Change the final `ROLLBACK` to `COMMIT` (single-line edit at bottom)
--   2. Re-run against the SAME database
--   3. Change back to `ROLLBACK` before committing the file to git
--
-- Run via Supabase MCP (`mcp__supabase__execute_sql` for dev /
-- `mcp__supabase-prod__execute_sql` for prod) or via psql against the
-- Session Pooler endpoint.
--
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Pre-flight: resolve the current build cycle (exactly one, or abort)
-- -----------------------------------------------------------------------------

CREATE TEMP TABLE _cur_cycle ON COMMIT DROP AS
SELECT id AS cycle_id, name
FROM cycles
WHERE status = 'active' AND mode = 'open' AND lab_id IS NULL;

DO $$
DECLARE
  n INT;
  cid INT;
  cname TEXT;
BEGIN
  SELECT COUNT(*), MAX(cycle_id), MAX(name) INTO n, cid, cname FROM _cur_cycle;
  IF n = 0 THEN
    RAISE EXCEPTION 'No active open (mode=open, lab_id NULL) cycle found. Aborting.';
  ELSIF n > 1 THEN
    RAISE EXCEPTION 'Multiple active open cycles found (% rows) — invariant violated. Refusing to guess. Aborting.', n;
  END IF;
  RAISE NOTICE 'Current build cycle resolved: id=% name=%', cid, cname;
END $$;

-- -----------------------------------------------------------------------------
-- Resolve the target participants (case-insensitive email match)
-- -----------------------------------------------------------------------------

CREATE TEMP TABLE _targets ON COMMIT DROP AS
SELECT p.id AS participant_id, lower(p.email) AS email
FROM participants p
WHERE lower(p.email) IN (
  'sandra@upskillinglabs.org',
  'jennaschmidt08@gmail.com',
  'amg@withlevy.com',
  'mayturose5@gmail.com'
);

-- Warn about any address that didn't resolve to a participant, and about any
-- resolved participant who isn't actually enrolled in the current cycle
-- (nothing to remove for them — the run just skips them).
DO $$
DECLARE
  addr TEXT;
  matched INT;
  enrolled INT;
BEGIN
  FOREACH addr IN ARRAY ARRAY[
    'sandra@upskillinglabs.org',
    'jennaschmidt08@gmail.com',
    'amg@withlevy.com',
    'mayturose5@gmail.com'
  ] LOOP
    SELECT COUNT(*) INTO matched FROM _targets WHERE email = addr;
    IF matched = 0 THEN
      RAISE NOTICE 'WARNING: no participant found for %', addr;
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO matched FROM _targets;
  SELECT COUNT(*) INTO enrolled
  FROM cycle_enrollments ce
  WHERE ce.cycle_id IN (SELECT cycle_id FROM _cur_cycle)
    AND ce.participant_id IN (SELECT participant_id FROM _targets);
  RAISE NOTICE 'Pre-flight: % of 4 emails matched a participant | % of them enrolled in the current cycle',
    matched, enrolled;
END $$;

-- -----------------------------------------------------------------------------
-- BEFORE counts
-- -----------------------------------------------------------------------------

CREATE TEMP TABLE _before_counts (label TEXT, n BIGINT) ON COMMIT DROP;

INSERT INTO _before_counts
  SELECT 'active pod_memberships (this cycle)', COUNT(*)
    FROM pod_memberships m
    JOIN pods pod ON pod.id = m.pod_id
   WHERE pod.cycle_id IN (SELECT cycle_id FROM _cur_cycle)
     AND m.participant_id IN (SELECT participant_id FROM _targets)
     AND m.inactive_at IS NULL
UNION ALL
  SELECT 'active project_memberships (this cycle)', COUNT(*)
    FROM project_memberships pm
   WHERE pm.cycle_id IN (SELECT cycle_id FROM _cur_cycle)
     AND pm.participant_id IN (SELECT participant_id FROM _targets)
     AND pm.left_at IS NULL
UNION ALL
  SELECT 'active cycle_enrollments (this cycle)', COUNT(*)
    FROM cycle_enrollments ce
   WHERE ce.cycle_id IN (SELECT cycle_id FROM _cur_cycle)
     AND ce.participant_id IN (SELECT participant_id FROM _targets)
     AND ce.status = 'active';

-- -----------------------------------------------------------------------------
-- Apply the removal (soft, cycle-scoped)
-- -----------------------------------------------------------------------------

-- 1. Soft-delete pod memberships whose pod belongs to THIS cycle only.
--    Two-step (collect ids, then update by id) because a joined predicate on
--    an UPDATE shapes only the returned rows, not the mutation — an inline
--    join on pods.cycle_id would soft-delete memberships in every cycle
--    (see the note in revocations/check/[cycle_id]/route.ts).
CREATE TEMP TABLE _pm_ids ON COMMIT DROP AS
SELECT m.id
FROM pod_memberships m
JOIN pods pod ON pod.id = m.pod_id
WHERE pod.cycle_id IN (SELECT cycle_id FROM _cur_cycle)
  AND m.participant_id IN (SELECT participant_id FROM _targets)
  AND m.inactive_at IS NULL;

UPDATE pod_memberships
   SET inactive_at = now()
 WHERE id IN (SELECT id FROM _pm_ids);

-- 2. Soft-delete project memberships for this cycle (project_memberships
--    carries cycle_id directly, so this is safe to scope inline).
UPDATE project_memberships
   SET left_at = now()
 WHERE cycle_id IN (SELECT cycle_id FROM _cur_cycle)
   AND participant_id IN (SELECT participant_id FROM _targets)
   AND left_at IS NULL;

-- 3. Enrollment -> inactive (row kept — they stay a known, reactivatable
--    upskiller). The app derives this via the reconciler after the pod
--    memberships are gone; here we set the same end state directly.
UPDATE cycle_enrollments
   SET status = 'inactive',
       inactive_date = now()
 WHERE cycle_id IN (SELECT cycle_id FROM _cur_cycle)
   AND participant_id IN (SELECT participant_id FROM _targets)
   AND status <> 'inactive';

-- 4. Audit trail — one 'full'-scope revocation row per targeted person who is
--    (or was) enrolled in this cycle.
INSERT INTO access_revocations
  (participant_id, cycle_id, reason, revocation_scope, revoked_systems)
SELECT t.participant_id,
       c.cycle_id,
       'manual_admin_removal',
       'full',
       ARRAY['pod_membership', 'project_membership', 'enrollment']
FROM _targets t
CROSS JOIN _cur_cycle c
WHERE EXISTS (
  SELECT 1 FROM cycle_enrollments ce
   WHERE ce.cycle_id = c.cycle_id
     AND ce.participant_id = t.participant_id
);

-- -----------------------------------------------------------------------------
-- AFTER report — every "active … (this cycle)" after-count should be 0
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  before_pm  BIGINT; before_pj  BIGINT; before_en  BIGINT;
  after_pm   BIGINT; after_pj   BIGINT; after_en   BIGINT;
  audit_rows BIGINT;
BEGIN
  SELECT n INTO before_pm FROM _before_counts WHERE label = 'active pod_memberships (this cycle)';
  SELECT n INTO before_pj FROM _before_counts WHERE label = 'active project_memberships (this cycle)';
  SELECT n INTO before_en FROM _before_counts WHERE label = 'active cycle_enrollments (this cycle)';

  SELECT COUNT(*) INTO after_pm
    FROM pod_memberships m JOIN pods pod ON pod.id = m.pod_id
   WHERE pod.cycle_id IN (SELECT cycle_id FROM _cur_cycle)
     AND m.participant_id IN (SELECT participant_id FROM _targets)
     AND m.inactive_at IS NULL;

  SELECT COUNT(*) INTO after_pj
    FROM project_memberships pm
   WHERE pm.cycle_id IN (SELECT cycle_id FROM _cur_cycle)
     AND pm.participant_id IN (SELECT participant_id FROM _targets)
     AND pm.left_at IS NULL;

  SELECT COUNT(*) INTO after_en
    FROM cycle_enrollments ce
   WHERE ce.cycle_id IN (SELECT cycle_id FROM _cur_cycle)
     AND ce.participant_id IN (SELECT participant_id FROM _targets)
     AND ce.status = 'active';

  SELECT COUNT(*) INTO audit_rows
    FROM access_revocations ar
   WHERE ar.cycle_id IN (SELECT cycle_id FROM _cur_cycle)
     AND ar.participant_id IN (SELECT participant_id FROM _targets)
     AND ar.reason = 'manual_admin_removal';

  RAISE NOTICE '--- Removal report (active rows in current cycle) ---';
  RAISE NOTICE 'What                              | Before | After';
  RAISE NOTICE '----------------------------------+--------+------';
  RAISE NOTICE '% | % | %', rpad('active pod_memberships', 32), lpad(before_pm::TEXT, 6), lpad(after_pm::TEXT, 5);
  RAISE NOTICE '% | % | %', rpad('active project_memberships', 32), lpad(before_pj::TEXT, 6), lpad(after_pj::TEXT, 5);
  RAISE NOTICE '% | % | %', rpad('active cycle_enrollments', 32), lpad(before_en::TEXT, 6), lpad(after_en::TEXT, 5);
  RAISE NOTICE '----------------------------------+--------+------';
  RAISE NOTICE 'access_revocations rows written this run: %', audit_rows;
  RAISE NOTICE 'Note: participants rows and roles are untouched — they remain upskillers.';
END $$;

-- -----------------------------------------------------------------------------
-- DEFAULT: rollback so this script is safe to dry-run.
-- After reviewing the report, change `ROLLBACK` to `COMMIT` and re-run.
-- -----------------------------------------------------------------------------

ROLLBACK;
-- COMMIT;
