-- 00062_local_labs.sql
-- Local Labs as an organizational tier: HQ + local labs, cycles centrally
-- coordinated by HQ, each lab with its own leadership, workstream teams,
-- pods, and participants. `docs/LOCAL_LABS.md` (this PR) is the design doc.
--
-- The lab entity is the existing `metros` table — already the product's
-- "Local Labs" (public /local-labs surface, participants assigned by zip via
-- participants.metro_id). This migration promotes it from content-only to an
-- organizational anchor: `cycles.lab_id` and `workstreams.lab_id` FK to
-- metros, and `lab_leads` carries lab-scoped leadership (the
-- moderator_assignments pattern, one tier up).
--
-- NULL lab_id = HQ/global. Every existing row keeps working with zero
-- backfill; nothing user-visible changes until the first non-NULL-lab cycle
-- is created.
--
-- Labs are ORTHOGONAL to sectors (owner constraint): a sector is the
-- durable, global, thematic home projects graduate to as open source
-- (SECTOR_MODEL.md §6); a lab is the local delivery tier that facilitates
-- project creation through per-cohort pods. Nothing here touches sectors.
--
-- Idempotent + re-runnable.
--
-- DOWN:
--   ALTER TABLE metros DROP COLUMN IF EXISTS is_default;
--   DROP TABLE IF EXISTS lab_leads;
--   DROP INDEX IF EXISTS one_upcoming_cycle_per_mode_lab;
--   DROP INDEX IF EXISTS one_active_cycle_per_mode_lab;
--   CREATE UNIQUE INDEX IF NOT EXISTS one_active_open_cycle
--     ON cycles ((status)) WHERE status = 'active' AND mode = 'open';
--   CREATE UNIQUE INDEX IF NOT EXISTS one_upcoming_open_cycle
--     ON cycles ((status)) WHERE status = 'upcoming' AND mode = 'open';
--   CREATE UNIQUE INDEX IF NOT EXISTS one_active_org_cycle
--     ON cycles ((status)) WHERE status = 'active' AND mode = 'org';
--   CREATE UNIQUE INDEX IF NOT EXISTS one_upcoming_org_cycle
--     ON cycles ((status)) WHERE status = 'upcoming' AND mode = 'org';
--   ALTER TABLE workstreams DROP CONSTRAINT IF EXISTS workstreams_one_home_check;
--   -- requires zero NULL rows in workstreams.sector_id first:
--   ALTER TABLE workstreams ALTER COLUMN sector_id SET NOT NULL;
--   ALTER TABLE workstreams DROP COLUMN IF EXISTS lab_id;
--   DROP INDEX IF EXISTS idx_cycles_lab;
--   ALTER TABLE cycles DROP COLUMN IF EXISTS lab_id;

-- ── 1. cycles + workstreams gain a lab home (NULL = HQ/global) ──────────
ALTER TABLE cycles ADD COLUMN IF NOT EXISTS lab_id INT REFERENCES metros(id);
CREATE INDEX IF NOT EXISTS idx_cycles_lab ON cycles(lab_id);

-- A workstream lives in exactly one home: HQ workstreams keep their
-- sector_id (the seeded HQ sector, 00060); a lab's internal workstream
-- ("Baltimore ops") has no thematic sector — it carries lab_id instead.
-- Inventing per-lab sector rows would smuggle places into the theme axis.
ALTER TABLE workstreams ADD COLUMN IF NOT EXISTS lab_id INT REFERENCES metros(id);
CREATE INDEX IF NOT EXISTS idx_workstreams_lab ON workstreams(lab_id);
ALTER TABLE workstreams ALTER COLUMN sector_id DROP NOT NULL;
ALTER TABLE workstreams DROP CONSTRAINT IF EXISTS workstreams_one_home_check;
ALTER TABLE workstreams ADD CONSTRAINT workstreams_one_home_check
  CHECK (num_nonnulls(sector_id, lab_id) = 1);

-- ── 2. Rescope the cycle invariant per (mode, lab) ──────────────────────
-- 00060 made the ≤1-active/≤1-upcoming invariant per-mode; labs make it per
-- (mode, lab). COALESCE(lab_id, 0) gives HQ/global (NULL) its own bucket, so
-- HQ's invariant is preserved verbatim while each lab gets its own stream.
-- `mode='closed'` (B2B) stays unconstrained (SECTOR_MODEL §10).
DROP INDEX IF EXISTS one_active_open_cycle;
DROP INDEX IF EXISTS one_upcoming_open_cycle;
DROP INDEX IF EXISTS one_active_org_cycle;
DROP INDEX IF EXISTS one_upcoming_org_cycle;

CREATE UNIQUE INDEX IF NOT EXISTS one_active_cycle_per_mode_lab
  ON cycles (mode, (COALESCE(lab_id, 0)))
  WHERE status = 'active' AND mode IN ('open', 'org');
CREATE UNIQUE INDEX IF NOT EXISTS one_upcoming_cycle_per_mode_lab
  ON cycles (mode, (COALESCE(lab_id, 0)))
  WHERE status = 'upcoming' AND mode IN ('open', 'org');

-- ── 3. lab_leads: lab-scoped leadership ─────────────────────────────────
-- The moderator_assignments pattern one tier up: HQ admins appoint leads
-- (service-role writes only); the app resolves leadership per request in
-- resolveUserRoles. Removal stamps removed_at (audit trail, re-grantable —
-- the partial unique allows a fresh active row after removal).
CREATE TABLE IF NOT EXISTS lab_leads (
  id             SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id),
  lab_id         INT NOT NULL REFERENCES metros(id),
  assigned_by    INT REFERENCES participants(id),
  assigned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at     TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_lab_lead
  ON lab_leads(participant_id, lab_id) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lab_leads_lab ON lab_leads(lab_id);

ALTER TABLE lab_leads ENABLE ROW LEVEL SECURITY;
-- Self-read is load-bearing: resolveUserRoles runs on the user-scoped client
-- (mirrors moderator_assignments_select, 00002). Writes stay service-role.
DROP POLICY IF EXISTS "lab_leads_select" ON lab_leads;
CREATE POLICY "lab_leads_select" ON lab_leads FOR SELECT TO authenticated
  USING (participant_id = current_participant_id() OR is_admin_or_owner());

-- ── 4. Deterministic zip fallback ───────────────────────────────────────
-- metroFromZip's unmatched-zip fallback is "the active metro" — correct with
-- one active lab, nondeterministic with two. is_default names the catch-all.
ALTER TABLE metros ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;
UPDATE metros SET is_default = true
WHERE slug = 'dc'
  AND NOT EXISTS (SELECT 1 FROM metros WHERE is_default);
