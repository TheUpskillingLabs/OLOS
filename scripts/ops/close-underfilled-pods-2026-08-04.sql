-- =============================================================================
-- close-underfilled-pods-2026-08-04.sql — Dissolve pods that never hit pod_min
-- =============================================================================
--
-- Purpose
-- -------
-- One-off close of `forming` pods that never reached their cycle's
-- `cycle_config.pod_min` (currently 12 for the active cycle). Mirrors the
-- pod half of `closeOutCycle()` (lib/cycle/closeout.ts) — same status flip
-- and soft-delete pattern — but scoped to only the underfilled pods in one
-- cycle, not every pod in it, and does NOT touch the cycle itself, its
-- other (already-active) pods, or project governance.
--
-- Only targets pods with status = 'forming'. Pods already `active` are left
-- alone even if headcount has since dropped below pod_min — that's a
-- different, more sensitive case (people already committed/working) and is
-- explicitly out of scope for this one-off (tracked separately as feedback
-- #14, docs/feedback-running-list.md).
--
-- What it does, per targeted pod
-- -------------------------------
--   pods                    status 'forming' -> 'dissolved'
--   pod_memberships         open rows (inactive_at IS NULL) -> inactive_at = now()
--   moderator_assignments   open rows (removed_at IS NULL)  -> removed_at = now()
--
-- Cycle resolution
-- ----------------
-- Targets the single cycle with status = 'active' (the schema enforces at
-- most one). If that's not the cycle you mean, replace the WHERE clause in
-- `_target_cycle` below with `WHERE id = <cycle_id>`.
--
-- Two-pass dry-run pattern (same convention as reset-energy-participants.sql)
-- -----------------------------------------------------------------------------
-- This script ends with `ROLLBACK` by default. Run it once in the Supabase
-- SQL Editor, read the NOTICE report, sanity-check the pod list and counts,
-- then:
--
--   1. Change the final `ROLLBACK` to `COMMIT` (single-line edit at the bottom)
--   2. Re-run against the SAME database
--   3. Change back to `ROLLBACK` before committing this file to git
--
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Pre-flight: resolve the target cycle and its pod_min
-- -----------------------------------------------------------------------------

CREATE TEMP TABLE _target_cycle ON COMMIT DROP AS
SELECT c.id AS cycle_id, c.name, cc.pod_min
FROM cycles c
JOIN cycle_config cc ON cc.cycle_id = c.id
WHERE c.status = 'active';

DO $$
DECLARE
  n INT;
  target_id INT;
  target_name TEXT;
  target_pod_min INT;
BEGIN
  SELECT COUNT(*), MAX(cycle_id), MAX(name), MAX(pod_min)
    INTO n, target_id, target_name, target_pod_min
    FROM _target_cycle;
  IF n = 0 THEN
    RAISE EXCEPTION 'No active cycle found. Aborting — edit _target_cycle to target by id instead.';
  ELSIF n > 1 THEN
    RAISE EXCEPTION 'Multiple active cycles found (% rows). Refusing to guess. Aborting.', n;
  END IF;
  RAISE NOTICE 'Target cycle resolved: id=% name=% pod_min=%', target_id, target_name, target_pod_min;
END $$;

-- -----------------------------------------------------------------------------
-- Identify underfilled forming pods in the target cycle
-- -----------------------------------------------------------------------------

CREATE TEMP TABLE _underfilled_pods ON COMMIT DROP AS
SELECT
  p.id AS pod_id,
  p.name AS pod_name,
  tc.pod_min,
  COUNT(pm.id) FILTER (WHERE pm.inactive_at IS NULL) AS active_members
FROM pods p
JOIN _target_cycle tc ON tc.cycle_id = p.cycle_id
LEFT JOIN pod_memberships pm ON pm.pod_id = p.id
WHERE p.status = 'forming'
GROUP BY p.id, p.name, tc.pod_min
HAVING COUNT(pm.id) FILTER (WHERE pm.inactive_at IS NULL) < tc.pod_min;

DO $$
DECLARE
  r RECORD;
  n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM _underfilled_pods;
  RAISE NOTICE '--- % underfilled forming pod(s) targeted ---', n;
  FOR r IN SELECT * FROM _underfilled_pods ORDER BY pod_id LOOP
    RAISE NOTICE 'pod_id=% name=% active_members=%/%', r.pod_id, r.pod_name, r.active_members, r.pod_min;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- BEFORE counts (open memberships / assignments on the targeted pods)
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  memberships_before INT;
  assignments_before INT;
BEGIN
  SELECT COUNT(*) INTO memberships_before
    FROM pod_memberships
   WHERE pod_id IN (SELECT pod_id FROM _underfilled_pods) AND inactive_at IS NULL;
  SELECT COUNT(*) INTO assignments_before
    FROM moderator_assignments
   WHERE pod_id IN (SELECT pod_id FROM _underfilled_pods) AND removed_at IS NULL;
  RAISE NOTICE 'Before: % open pod_memberships | % open moderator_assignments', memberships_before, assignments_before;
END $$;

-- -----------------------------------------------------------------------------
-- Close the pods
-- -----------------------------------------------------------------------------

UPDATE pods
   SET status = 'dissolved'
 WHERE id IN (SELECT pod_id FROM _underfilled_pods)
   AND status = 'forming';

UPDATE pod_memberships
   SET inactive_at = now()
 WHERE pod_id IN (SELECT pod_id FROM _underfilled_pods)
   AND inactive_at IS NULL;

UPDATE moderator_assignments
   SET removed_at = now()
 WHERE pod_id IN (SELECT pod_id FROM _underfilled_pods)
   AND removed_at IS NULL;

-- -----------------------------------------------------------------------------
-- AFTER report — pods should now read 'dissolved', open counts should be 0
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  r RECORD;
  memberships_after INT;
  assignments_after INT;
BEGIN
  RAISE NOTICE '--- After ---';
  FOR r IN
    SELECT id, name, status FROM pods
     WHERE id IN (SELECT pod_id FROM _underfilled_pods)
     ORDER BY id
  LOOP
    RAISE NOTICE 'pod_id=% name=% status=%', r.id, r.name, r.status;
  END LOOP;
  SELECT COUNT(*) INTO memberships_after
    FROM pod_memberships
   WHERE pod_id IN (SELECT pod_id FROM _underfilled_pods) AND inactive_at IS NULL;
  SELECT COUNT(*) INTO assignments_after
    FROM moderator_assignments
   WHERE pod_id IN (SELECT pod_id FROM _underfilled_pods) AND removed_at IS NULL;
  RAISE NOTICE 'After: % open pod_memberships | % open moderator_assignments', memberships_after, assignments_after;
END $$;

-- -----------------------------------------------------------------------------
-- DEFAULT: rollback so this script is safe to dry-run.
-- After reviewing the report, change `ROLLBACK` to `COMMIT` and re-run.
-- -----------------------------------------------------------------------------

ROLLBACK;
-- COMMIT;
