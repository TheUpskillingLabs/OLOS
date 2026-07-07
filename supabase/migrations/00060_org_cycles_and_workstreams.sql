-- 00060_org_cycles_and_workstreams.sql
-- Org cycles: the org (HQ + Core Contributors) runs quarterly cycles on
-- internal workstreams, dogfooding the participant cycle machinery instead of
-- forking it. `docs/ORG_CYCLES.md` (this PR) is the design doc; the schema
-- decisions below are SECTOR_MODEL.md §7 (data model) / §10 (open questions).
--
-- Org cycles are `cycles.mode='org'` under a seeded "The Upskilling Labs HQ"
-- sector. Durable workstreams (new table) get per-quarter "runs" which are
-- ordinary `pods` rows (`pods.workstream_id` FK, created `status='active'`,
-- `problem_statement_id` nullable — a run isn't voted into existence from a
-- problem-statement ballot the way a participant pod is). Co-leads are
-- `moderator_assignments` + `pod_memberships` on the run; core contributors
-- are invite-only `pod_memberships`; ICs are `project_subscriptions`
-- (self-serve follow) + `project_roles` (`dri`/`contributor`); board/exec use
-- the existing `user_roles` owner/admin.
--
-- The participant cycle and the org cycle are BOTH `status='active'`
-- simultaneously — 00048's header already flagged this exact rescope as the
-- documented future refinement ("this index may be scoped to `mode='open'`
-- ... a documented future refinement, not a rewrite") and 00049 built `mode`
-- for it. This migration cashes that in: the single global ≤1-active/
-- ≤1-upcoming invariant becomes ≤1-active + ≤1-upcoming PER MODE. Every "the
-- active cycle" read in application code must become mode-aware (org reads
-- ask for `mode='org'`, participant reads for `mode='open'`) — tracked in
-- `docs/ORG_CYCLES.md`, not a schema concern.
--
-- Idempotent + re-runnable.
--
-- DOWN:
--   DROP TABLE IF EXISTS project_subscriptions;
--   DROP TABLE IF EXISTS project_roles;
--   ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_pod_role_check;
--   ALTER TABLE invitations DROP COLUMN IF EXISTS pod_role;
--   ALTER TABLE projects DROP COLUMN IF EXISTS forked_from_project_id;
--   -- requires zero NULL rows in projects.solution_proposal_id first:
--   ALTER TABLE projects ALTER COLUMN solution_proposal_id SET NOT NULL;
--   DROP INDEX IF EXISTS idx_pods_workstream;
--   DROP INDEX IF EXISTS one_run_per_workstream_per_cycle;
--   -- requires zero NULL rows in pods.problem_statement_id first:
--   ALTER TABLE pods ALTER COLUMN problem_statement_id SET NOT NULL;
--   ALTER TABLE pods DROP COLUMN IF EXISTS workstream_id;
--   DROP TABLE IF EXISTS workstreams;
--   DELETE FROM sectors WHERE slug = 'the-upskilling-labs-hq';
--   DROP INDEX IF EXISTS one_upcoming_org_cycle;
--   DROP INDEX IF EXISTS one_active_org_cycle;
--   DROP INDEX IF EXISTS one_upcoming_open_cycle;
--   DROP INDEX IF EXISTS one_active_open_cycle;
--   CREATE UNIQUE INDEX IF NOT EXISTS one_upcoming_cycle ON cycles ((status)) WHERE status = 'upcoming';
--   CREATE UNIQUE INDEX IF NOT EXISTS one_active_cycle ON cycles ((status)) WHERE status = 'active';
--   ALTER TABLE cycles DROP CONSTRAINT IF EXISTS cycles_mode_check;
--   ALTER TABLE cycles ADD CONSTRAINT cycles_mode_check
--     CHECK (mode IN ('open', 'closed')) NOT VALID;

-- ── 1. Widen cycles.mode ────────────────────────────────────────────────
-- 00049 added `mode` with an inline CHECK, which Postgres auto-names
-- `cycles_mode_check` (table_column_check convention) — drop by that name.
ALTER TABLE cycles DROP CONSTRAINT IF EXISTS cycles_mode_check;
ALTER TABLE cycles ADD CONSTRAINT cycles_mode_check
  CHECK (mode IN ('open', 'closed', 'org')) NOT VALID;

-- ── 2. Rescope the single-active-cycle invariant per mode ──────────────
-- 00048/00049's global one_active_cycle / one_upcoming_cycle assumed a single
-- cycle stream. Org cycles run on their own quarterly clock, concurrently
-- with the participant cycle, so the invariant becomes ≤1 active + ≤1
-- upcoming PER MODE rather than globally. `mode='closed'` (B2B) stays
-- unconstrained — SECTOR_MODEL §10 defers that track; it may run several
-- closed cycles in parallel.
DROP INDEX IF EXISTS one_active_cycle;
DROP INDEX IF EXISTS one_upcoming_cycle;

CREATE UNIQUE INDEX IF NOT EXISTS one_active_open_cycle
  ON cycles ((status)) WHERE status = 'active' AND mode = 'open';
CREATE UNIQUE INDEX IF NOT EXISTS one_upcoming_open_cycle
  ON cycles ((status)) WHERE status = 'upcoming' AND mode = 'open';
CREATE UNIQUE INDEX IF NOT EXISTS one_active_org_cycle
  ON cycles ((status)) WHERE status = 'active' AND mode = 'org';
CREATE UNIQUE INDEX IF NOT EXISTS one_upcoming_org_cycle
  ON cycles ((status)) WHERE status = 'upcoming' AND mode = 'org';

-- ── 3. Seed the HQ sector ───────────────────────────────────────────────
-- Trivial lookup row: org cycle creation needs a sector_id and there is no
-- sector CRUD (sectors are still service-role-only, per 00049).
INSERT INTO sectors (name, slug, description)
VALUES (
  'The Upskilling Labs HQ',
  'the-upskilling-labs-hq',
  'The org itself — HQ + Core Contributors running the org''s own quarterly cycles on internal workstreams.'
)
ON CONFLICT (slug) DO NOTHING;

-- ── 4. workstreams ───────────────────────────────────────────────────────
-- A workstream is the durable, cross-cycle unit of internal org work (e.g.
-- "Moderator tooling", "Sector governance"). Each quarter's org cycle spins
-- up a "run" per active workstream — an ordinary `pods` row, so the run
-- reuses pod machinery (memberships, moderator_assignments, projects) rather
-- than forking it.
CREATE TABLE IF NOT EXISTS workstreams (
  id          SERIAL PRIMARY KEY,
  sector_id   INT NOT NULL REFERENCES sectors(id),
  name        VARCHAR(40) NOT NULL,  -- matches pods.name length so runs can copy it verbatim
  slug        VARCHAR(200) UNIQUE NOT NULL,
  description TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'dormant')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_workstreams_updated_at ON workstreams;
CREATE TRIGGER trg_workstreams_updated_at BEFORE UPDATE ON workstreams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE workstreams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workstreams_select ON workstreams;
CREATE POLICY workstreams_select ON workstreams FOR SELECT USING (true);
-- No write policies: service-role only, same posture as sectors (00049).

-- A workstream "run" is a pods row for a given cycle. `problem_statement_id`
-- goes nullable because runs are chartered by the workstream, not voted into
-- existence from a problem-statement ballot the way a participant pod is.
ALTER TABLE pods ADD COLUMN IF NOT EXISTS workstream_id INT REFERENCES workstreams(id);
ALTER TABLE pods ALTER COLUMN problem_statement_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS one_run_per_workstream_per_cycle
  ON pods(workstream_id, cycle_id) WHERE workstream_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pods_workstream ON pods(workstream_id);

-- ── 5. projects: chartered org projects + fork lineage ──────────────────
-- Org projects are chartered by a workstream run's co-leads, not voted out of
-- a solution_proposals ballot — so the FK goes nullable, mirroring pods above.
ALTER TABLE projects ALTER COLUMN solution_proposal_id DROP NOT NULL;
-- Fork lineage pointer only (an org project forked from a participant
-- project, or vice versa) — no endpoint/UI this slice, just provenance.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS forked_from_project_id INT REFERENCES projects(id);

-- ── 6. invitations: pod_role for org-cycle co-lead invites ──────────────
-- NULL = legacy poderator-only fulfillment (pre-existing invitations and any
-- invite that doesn't carry a pod-level role); 'co_lead' fulfills into
-- moderator_assignments + pod_memberships, 'member' into pod_memberships
-- only. Nullable column, so NULL passes the CHECK automatically.
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS pod_role VARCHAR(20);
ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_pod_role_check;
ALTER TABLE invitations ADD CONSTRAINT invitations_pod_role_check
  CHECK (pod_role IN ('co_lead', 'member')) NOT VALID;

-- ── 7. IC tables: project_roles + project_subscriptions ─────────────────
-- The open-source-style IC ladder (SECTOR_MODEL §5/§7): a participant
-- subscribes (follows) a project self-serve, and a DRI can promote a
-- subscriber (or anyone) into an active project_roles row.
CREATE TABLE IF NOT EXISTS project_roles (
  id             SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id),
  project_id     INT NOT NULL REFERENCES projects(id),
  role           VARCHAR(20) NOT NULL CHECK (role IN ('dri', 'contributor')),
  invited_by     INT REFERENCES participants(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at     TIMESTAMPTZ
);

-- One active role per person per project — re-adding after removal is a new row.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_project_role
  ON project_roles(participant_id, project_id) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_project_roles_project ON project_roles(project_id);

ALTER TABLE project_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_roles_select ON project_roles;
CREATE POLICY project_roles_select ON project_roles FOR SELECT USING (true);
-- Public read: the open-source ladder is public (SECTOR_MODEL §5). No write
-- policies — service-role only; the DRI check is enforced in app code.

CREATE TABLE IF NOT EXISTS project_subscriptions (
  id             SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id),
  project_id     INT NOT NULL REFERENCES projects(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (participant_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_subscriptions_project ON project_subscriptions(project_id);

-- Self read/write (mirrors saved_items, 00050), plus staff read via
-- can_write_cycles() (00037's honestly-named owner/admin/dev helper — the
-- same staff-read posture learning_logs 00040 uses).
ALTER TABLE project_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_subscriptions_select ON project_subscriptions;
CREATE POLICY project_subscriptions_select ON project_subscriptions FOR SELECT
  USING (participant_id = current_participant_id() OR can_write_cycles());

DROP POLICY IF EXISTS project_subscriptions_insert ON project_subscriptions;
CREATE POLICY project_subscriptions_insert ON project_subscriptions FOR INSERT
  WITH CHECK (participant_id = current_participant_id());

DROP POLICY IF EXISTS project_subscriptions_delete ON project_subscriptions;
CREATE POLICY project_subscriptions_delete ON project_subscriptions FOR DELETE
  USING (participant_id = current_participant_id());
