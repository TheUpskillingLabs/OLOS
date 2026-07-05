-- 00048_single_active_cycle.sql
-- Enforce the house invariant: at most ONE cycle is 'active' at a time.
-- Nothing enforced this, so two cycles drifted to 'active' on dev — which 406s
-- every `.eq('status','active').maybeSingle()` read (the home page, the signup
-- funnel, the learning-log gate + POST) and made the dashboard pick the future
-- cohort over the running one (it orders by latest start_date).
--
-- Forward-compatible groundwork for SECTOR_MODEL.md Phase A, which keeps this
-- invariant and adds a sibling ≤1-'upcoming' index. The 'upcoming' state is not
-- built yet; today a not-yet-started next cohort sits in 'draft'. When Phase A
-- lands `cycles.mode`, this index may be scoped to `mode='open'` (closed B2B
-- cycles may run in parallel) — a documented future refinement, not a rewrite.
--
-- Two parts, idempotent + re-runnable:
--   (1) reconcile any existing >1 active to a single one — keep the cycle that
--       best represents "now" (in its date window; else already-started latest;
--       else latest start_date), demote the rest to 'draft' (reversible; never
--       terminates a cohort). No-op where the invariant already holds.
--   (2) a partial unique index so it cannot recur, whatever the code path (the
--       status route AND advance-phase both activate cycles).
--
-- DOWN:
--   DROP INDEX IF EXISTS one_active_cycle;

-- (1) Reconcile: keep one active cycle, demote the others to draft.
WITH keep AS (
  SELECT id FROM cycles WHERE status = 'active'
  ORDER BY
    (start_date <= now() AND (end_date IS NULL OR end_date >= now())) DESC,
    (start_date <= now()) DESC,
    start_date DESC
  LIMIT 1
)
UPDATE cycles c SET status = 'draft'
 WHERE c.status = 'active'
   AND c.id NOT IN (SELECT id FROM keep);

-- (2) At most one active cycle, ever. All qualifying rows share status='active',
-- so a unique index over that partial set admits exactly one.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_cycle
  ON cycles ((status))
  WHERE status = 'active';
