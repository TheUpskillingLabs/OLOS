-- HQ / Local-Lab cycle model. Corrects the earlier "one cycle = one lab"
-- assumption (00038 added cycles.metro_slug and gated labs leads on it).
--
-- The real model: HQ centrally coordinates OPEN cycles that all Local Labs
-- (metros: dc/baltimore/philadelphia) participate in, and each lab runs its
-- OWN pods and projects within them. Labs can also run their own single-lab
-- internal cycles. And the cycle -> pod -> project primitive is additionally
-- reused to model HQ's own standing org structure (e.g. cycle 6 "Labs Summer
-- 2026": Programs & Events / Comms & Marketing / Pod Squad).
--
-- That is three cycle kinds, which metro_slug alone can't encode. So:
--
-- 1. cycles.is_hq_internal — hides HQ org/structural cycles from labs leads.
--    Combined with metro_slug: NULL + !internal = HQ-open (shared, per-lab
--    formation); metro set = a lab's own cycle; internal = HQ org structure.
--
-- 2. pods.metro_slug / projects.metro_slug — the lab boundary moves from the
--    cycle down to the pod/project. A labs lead manages pods/projects whose
--    metro matches theirs. NULL = an HQ/legacy pod (not any lab's). A project
--    inherits its pod's metro at creation. Mirrors participants.metro_slug
--    (see lib/metros.ts). Enforcement lives in lib/auth/cycle-access.ts.
--
-- Backfill: flag the known HQ org cycle internal. Existing pods/projects stay
-- NULL (they were formed cycle-wide before per-lab formation existed).

ALTER TABLE cycles
  ADD COLUMN IF NOT EXISTS is_hq_internal BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE pods
  ADD COLUMN IF NOT EXISTS metro_slug VARCHAR(50);

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS metro_slug VARCHAR(50);

-- Cycle 6 "Labs Summer 2026" is HQ's standing org structure, not a build cycle
-- or a lab cycle. Guard on the name so this is a no-op on environments where
-- that row doesn't exist or was renamed.
UPDATE cycles SET is_hq_internal = true
  WHERE id = 6 AND name = 'Labs Summer 2026';
