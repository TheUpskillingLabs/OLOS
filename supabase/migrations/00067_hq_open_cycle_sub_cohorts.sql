-- 00067_hq_open_cycle_sub_cohorts.sql
-- Local Labs pivot (docs/LOCAL_LABS.md): ONE HQ-run quarterly participant
-- cycle; labs are SUB-COHORTS within it, not parallel cycle streams. The
-- owner's "Local Labs should automatically be enrolled in the HQ-run
-- quarterly cycles" — a lab participates the moment HQ activates the cycle
-- (nothing to activate per lab), while individual members still opt in via
-- the join + agreement ceremony.
--
-- Structurally: a pod's lab identity can no longer be derived from its
-- cycle (every open-cycle pod's cycle is now the HQ NULL-lab cycle), so
-- pods carry their own lab tag. `pods.lab_id` is the pod's HOST SUB-COHORT
-- tag (which lab's slice it belongs to), not a membership fence — voting
-- stays global and cross-metro joins are allowed. Labs keep their own
-- mode='org' internal cycles; only mode='open' becomes HQ-only.
--
-- Idempotent + re-runnable.
--
-- DOWN:
--   ALTER TABLE cycles DROP CONSTRAINT IF EXISTS cycles_open_is_hq_when_live;
--   DROP INDEX IF EXISTS one_active_open_cycle;
--   DROP INDEX IF EXISTS one_upcoming_open_cycle;
--   CREATE UNIQUE INDEX IF NOT EXISTS one_active_cycle_per_mode_lab
--     ON cycles (mode, (COALESCE(lab_id, 0)))
--     WHERE status = 'active' AND mode IN ('open', 'org');
--   CREATE UNIQUE INDEX IF NOT EXISTS one_upcoming_cycle_per_mode_lab
--     ON cycles (mode, (COALESCE(lab_id, 0)))
--     WHERE status = 'upcoming' AND mode IN ('open', 'org');
--   -- (cycle lab_id fold and pod backfill are data moves — restore from a
--   --  snapshot if the per-lab open-cycle model must be recovered.)
--   DROP INDEX IF EXISTS idx_pods_lab;
--   ALTER TABLE pods DROP COLUMN IF EXISTS lab_id;

-- ── 1. Pods carry their lab (the sub-cohort tag) ─────────────────────────
ALTER TABLE pods ADD COLUMN IF NOT EXISTS lab_id INT REFERENCES metros(id);
CREATE INDEX IF NOT EXISTS idx_pods_lab ON pods(lab_id);

-- ── 2. Backfill BEFORE detaching cycles ──────────────────────────────────
-- Every existing pod inherits its cycle's lab so historical per-lab pods
-- keep their lab identity once their cycle folds to HQ below.
UPDATE pods p SET lab_id = c.lab_id
FROM cycles c
WHERE p.cycle_id = c.id AND p.lab_id IS DISTINCT FROM c.lab_id;

-- ── 3. Fold existing per-lab open cycles into the HQ stream ─────────────
-- Runs BEFORE the invariant re-scope so the data satisfies the new indexes.
-- A live (active/upcoming) per-lab open cycle that would COLLIDE with a
-- live HQ open cycle of the same status demotes to 'draft' first — under
-- the sub-cohort model it is a redundant duplicate of the HQ cohort, not a
-- second cohort (its pods keep their lab tag from step 2; verified empty on
-- dev: Baltimore Fall 2026 had 0 enrollments/agreements/pods). Terminal
-- (closed/archived) per-lab open cycles stay as history.
UPDATE cycles c SET status = 'draft'
WHERE c.mode = 'open' AND c.lab_id IS NOT NULL
  AND c.status IN ('active', 'upcoming')
  AND EXISTS (
    SELECT 1 FROM cycles h
    WHERE h.mode = 'open' AND h.lab_id IS NULL AND h.status = c.status AND h.id <> c.id
  );

UPDATE cycles c SET lab_id = NULL
WHERE c.mode = 'open' AND c.lab_id IS NOT NULL
  AND c.status NOT IN ('closed', 'archived');

-- ── 4. Re-scope the open-cycle invariant to HQ-global ────────────────────
-- 00062 made active/upcoming unique per (mode, lab). Open cycles are now a
-- single HQ stream: ≤1 active + ≤1 upcoming GLOBALLY for mode='open'
-- (restores 00060's shape for open). Org keeps per-(mode, lab) — labs still
-- run their own internal team cycles.
DROP INDEX IF EXISTS one_active_cycle_per_mode_lab;
DROP INDEX IF EXISTS one_upcoming_cycle_per_mode_lab;

CREATE UNIQUE INDEX IF NOT EXISTS one_active_open_cycle
  ON cycles ((status)) WHERE status = 'active' AND mode = 'open';
CREATE UNIQUE INDEX IF NOT EXISTS one_upcoming_open_cycle
  ON cycles ((status)) WHERE status = 'upcoming' AND mode = 'open';
CREATE UNIQUE INDEX IF NOT EXISTS one_active_org_cycle_per_lab
  ON cycles ((COALESCE(lab_id, 0))) WHERE status = 'active' AND mode = 'org';
CREATE UNIQUE INDEX IF NOT EXISTS one_upcoming_org_cycle_per_lab
  ON cycles ((COALESCE(lab_id, 0))) WHERE status = 'upcoming' AND mode = 'org';

-- A live participant cycle is always HQ's (the DB twin of the app guards).
ALTER TABLE cycles DROP CONSTRAINT IF EXISTS cycles_open_is_hq_when_live;
ALTER TABLE cycles ADD CONSTRAINT cycles_open_is_hq_when_live
  CHECK (NOT (mode = 'open' AND status IN ('active', 'upcoming') AND lab_id IS NOT NULL));
