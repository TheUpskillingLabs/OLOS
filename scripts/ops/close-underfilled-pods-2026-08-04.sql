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
-- Targets pods whose cycle has status = 'active'. If you mean a different
-- cycle, replace `c.status = 'active'` with `c.id = <cycle_id>` in BOTH
-- queries below.
--
-- How to run (two separate, self-contained statements — no temp tables, no
-- explicit BEGIN/ROLLBACK: each is a single atomic statement, safe to paste
-- into the Supabase SQL Editor on its own)
-- -----------------------------------------------------------------------------
--   1. Run Query 1 (read-only). Check the pod list and counts look right.
--   2. Only then run Query 2. It performs the update; either it fully
--      succeeds (one statement = one implicit transaction) or fully fails.
--      Its result row reports exactly what changed.
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Query 1 — PREVIEW (read-only, no side effects, safe to re-run any time)
-- -----------------------------------------------------------------------------

WITH target_cycle AS (
  SELECT c.id AS cycle_id, c.name AS cycle_name, cc.pod_min
  FROM cycles c
  JOIN cycle_config cc ON cc.cycle_id = c.id
  WHERE c.status = 'active'
)
SELECT
  p.id AS pod_id,
  p.name AS pod_name,
  tc.cycle_id,
  tc.cycle_name,
  tc.pod_min,
  COUNT(pm.id) FILTER (WHERE pm.inactive_at IS NULL) AS active_members
FROM pods p
JOIN target_cycle tc ON tc.cycle_id = p.cycle_id
LEFT JOIN pod_memberships pm ON pm.pod_id = p.id
WHERE p.status = 'forming'
GROUP BY p.id, p.name, tc.cycle_id, tc.cycle_name, tc.pod_min
HAVING COUNT(pm.id) FILTER (WHERE pm.inactive_at IS NULL) < tc.pod_min
ORDER BY p.id;

-- If this returns 0 rows: either every forming pod already meets pod_min, or
-- `target_cycle` matched no/multiple cycles — check `SELECT id, name, status
-- FROM cycles WHERE status = 'active';` returns exactly the one you expect.

-- -----------------------------------------------------------------------------
-- Query 2 — COMMIT (writes; run only after reviewing Query 1's output)
-- -----------------------------------------------------------------------------

WITH target_cycle AS (
  SELECT c.id AS cycle_id, cc.pod_min
  FROM cycles c
  JOIN cycle_config cc ON cc.cycle_id = c.id
  WHERE c.status = 'active'
),
target_pods AS (
  SELECT p.id AS pod_id
  FROM pods p
  JOIN target_cycle tc ON tc.cycle_id = p.cycle_id
  LEFT JOIN pod_memberships pm ON pm.pod_id = p.id
  WHERE p.status = 'forming'
  GROUP BY p.id, tc.pod_min
  HAVING COUNT(pm.id) FILTER (WHERE pm.inactive_at IS NULL) < tc.pod_min
),
close_pods AS (
  UPDATE pods
     SET status = 'dissolved'
   WHERE id IN (SELECT pod_id FROM target_pods)
     AND status = 'forming'
  RETURNING id
),
close_memberships AS (
  UPDATE pod_memberships
     SET inactive_at = now()
   WHERE pod_id IN (SELECT pod_id FROM target_pods)
     AND inactive_at IS NULL
  RETURNING id
),
close_assignments AS (
  UPDATE moderator_assignments
     SET removed_at = now()
   WHERE pod_id IN (SELECT pod_id FROM target_pods)
     AND removed_at IS NULL
  RETURNING id
)
SELECT
  (SELECT array_agg(id ORDER BY id) FROM close_pods) AS pods_dissolved_ids,
  (SELECT count(*) FROM close_pods)         AS pods_dissolved,
  (SELECT count(*) FROM close_memberships)  AS memberships_closed,
  (SELECT count(*) FROM close_assignments)  AS assignments_removed;

-- Expect pods_dissolved to match the row count from Query 1. If it's 0,
-- nothing matched `target_pods` at commit time (e.g. cycle status or
-- headcounts changed between the two runs) — re-run Query 1 to check.
