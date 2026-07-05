-- 00049_sector_model_phase_a.sql
-- SECTOR_MODEL.md Phase A — foundation & correctness. Schema only (data reconcile
-- is env-specific, applied separately). Introduces Sectors (the durable,
-- cross-cohort home for projects + field research), makes a cycle a run under a
-- sector, extends the cycle lifecycle (draft → upcoming → active → closing →
-- archived), and adds the cohort tier + project governance flag. No member-facing
-- surface yet (Phases B–D). Forward-compatible with migration 00048's ≤1-active
-- invariant (this adds the sibling ≤1-upcoming index).
--
-- Idempotent + re-runnable.
--
-- DOWN:
--   DROP INDEX IF EXISTS one_upcoming_cycle;
--   ALTER TABLE projects DROP COLUMN IF EXISTS governance, DROP COLUMN IF EXISTS sector_id;
--   ALTER TABLE cycle_enrollments DROP COLUMN IF EXISTS tier;
--   ALTER TABLE cycles DROP COLUMN IF EXISTS mode, DROP COLUMN IF EXISTS sector_id;
--   ALTER TABLE cycles DROP CONSTRAINT IF EXISTS cycles_status_check;
--   ALTER TABLE cycles ADD CONSTRAINT cycles_status_check
--     CHECK (status IN ('draft','active','closed')) NOT VALID;
--   DROP TABLE IF EXISTS sectors;

-- Sectors: the durable, member-governed home for a theme's projects + field
-- research + knowledge graph. Public commons (world-readable); writes are
-- service-role only.
CREATE TABLE IF NOT EXISTS sectors (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  slug        VARCHAR(200) UNIQUE NOT NULL,
  description TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'dormant')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sectors_select ON sectors;
CREATE POLICY sectors_select ON sectors FOR SELECT USING (true);

-- A cycle is a run under a sector. `mode` distinguishes open (publishes to the
-- commons) from closed (B2B) — the single-active/upcoming invariants apply to
-- open cycles; closed/B2B concurrency is deferred (SECTOR_MODEL §10).
ALTER TABLE cycles
  ADD COLUMN IF NOT EXISTS sector_id INT REFERENCES sectors(id),
  ADD COLUMN IF NOT EXISTS mode VARCHAR(10) NOT NULL DEFAULT 'open'
    CHECK (mode IN ('open', 'closed'));
CREATE INDEX IF NOT EXISTS idx_cycles_sector ON cycles(sector_id);

-- Extend the cycle lifecycle. 'closed' is retained for legacy terminal rows;
-- new cohorts wind down via closing → archived.
ALTER TABLE cycles DROP CONSTRAINT IF EXISTS cycles_status_check;
ALTER TABLE cycles ADD CONSTRAINT cycles_status_check
  CHECK (status IN ('draft', 'upcoming', 'active', 'closing', 'archived', 'closed'))
  NOT VALID;

-- Cohort tier: member (registered before the Hackathon; formation vote) vs
-- contributor (joined after; no formation vote).
ALTER TABLE cycle_enrollments
  ADD COLUMN IF NOT EXISTS tier VARCHAR(20) NOT NULL DEFAULT 'member'
    CHECK (tier IN ('member', 'contributor'));

-- Projects gain a durable sector home + a governance flag that flips cycle →
-- sector at graduation (Phase C).
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS sector_id INT REFERENCES sectors(id),
  ADD COLUMN IF NOT EXISTS governance VARCHAR(10) NOT NULL DEFAULT 'cycle'
    CHECK (governance IN ('cycle', 'sector'));
CREATE INDEX IF NOT EXISTS idx_projects_sector ON projects(sector_id);

-- At most one 'upcoming' cycle at a time (sibling to one_active_cycle, 00048).
CREATE UNIQUE INDEX IF NOT EXISTS one_upcoming_cycle
  ON cycles ((status))
  WHERE status = 'upcoming';
