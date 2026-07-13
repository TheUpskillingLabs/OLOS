-- 00086_cycle_phases_events.sql — Stage 1 of the calendar overhaul
-- (docs/requirements/cycle-timeline.md + implementation-plan.md, targeting
-- Cycle 3 staged inside the live cycle; owner decision 2026-07-12).
--
-- WHY: cycle scheduling becomes first-class. Phases and events become rows
-- (born TIMESTAMPTZ — real instants, no naive-column ambiguity), while the
-- twelve legacy cycle_config window columns stay in place as a dual-write
-- MIRROR maintained by lib/cycles/schedule.ts: cycle_phases is the source
-- of truth, and every boundary edit writes the computed bounds back into
-- the legacy columns so not-yet-migrated pages keep working unchanged
-- (implementation-plan simplification 1). The columns drop only when the
-- Stage 2 page sweep finishes — NOT here.
--
-- Seeding is generic, not Cycle-3-hardcoded:
--   * spine phases migrate from each open-mode cycle's existing
--     cycle_config values (naive columns hold the instant as UTC — the
--     verified S5.1 convention — so conversion is AT TIME ZONE 'UTC');
--     pod_registration_* seeds the pod_forming phase (pod-registration.md
--     two-window split).
--   * pod_active_join (overlay) derives from phase_2_start (the
--     Meet-the-Pods marker) → project_registration_close, when both exist.
--   * the six anchor events seed for the single live open HQ cycle from
--     the owner-confirmed calendar (lib/cycles/anchor-events.ts values,
--     ET → UTC) — Luma sync (00035) later upserts occurs_at/luma_api_id,
--     fulfilling that file's "interim until the events cache lands" note.
--
-- Org-mode cycles get no phase rows (cycle-timeline.md: the resolver keeps
-- its org-reject guard — the simpler invariant).
--
-- Idempotent: CREATE IF NOT EXISTS + ON CONFLICT DO NOTHING seeds.
--
-- DOWN:
--   DROP TABLE IF EXISTS cycle_events;
--   DROP TABLE IF EXISTS cycle_phases;
--   ALTER TABLE cycles DROP COLUMN IF EXISTS start_at;
--   ALTER TABLE metros DROP COLUMN IF EXISTS timezone;

-- ── cycles.start_at + metros.timezone ────────────────────────────────────

-- Cycle start as a real instant: start_date is a lab-local calendar date,
-- so midnight in the lab's zone.
ALTER TABLE cycles ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;
UPDATE cycles
SET start_at = (start_date::timestamp AT TIME ZONE 'America/New_York')
WHERE start_at IS NULL AND start_date IS NOT NULL;

ALTER TABLE metros
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York';

-- ── cycle_phases ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cycle_phases (
  id        SERIAL PRIMARY KEY,
  cycle_id  INT NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  phase_key TEXT NOT NULL CHECK (phase_key IN (
    'problem_statement', 'voting', 'pod_forming', 'pod_active_join',
    'solution_proposal', 'solution_voting', 'project_registration'
  )),
  kind      TEXT NOT NULL DEFAULT 'spine' CHECK (kind IN ('spine', 'overlay')),
  position  SMALLINT,                -- order, for spine phases
  anchor    TEXT,                    -- informational in v1 (seed, don't derive)
  duration  INTERVAL,                -- informational in v1
  starts_at TIMESTAMPTZ,
  ends_at   TIMESTAMPTZ,
  CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at),
  UNIQUE (cycle_id, phase_key)
);

CREATE INDEX IF NOT EXISTS idx_cycle_phases_cycle ON cycle_phases (cycle_id);

ALTER TABLE cycle_phases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cycle_phases_select ON cycle_phases;
CREATE POLICY cycle_phases_select ON cycle_phases
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS cycle_phases_write ON cycle_phases;
CREATE POLICY cycle_phases_write ON cycle_phases
  FOR ALL TO authenticated USING (is_admin_or_owner());

-- ── cycle_events ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cycle_events (
  id          SERIAL PRIMARY KEY,
  cycle_id    INT NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,   -- 'kickoff' | 'problem_sprint' | 'meet_the_pods' | …
  label       TEXT NOT NULL,
  occurs_at   TIMESTAMPTZ NOT NULL,
  luma_api_id TEXT,
  UNIQUE (cycle_id, key)
);

CREATE INDEX IF NOT EXISTS idx_cycle_events_cycle ON cycle_events (cycle_id);

ALTER TABLE cycle_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cycle_events_select ON cycle_events;
CREATE POLICY cycle_events_select ON cycle_events
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS cycle_events_write ON cycle_events;
CREATE POLICY cycle_events_write ON cycle_events
  FOR ALL TO authenticated USING (is_admin_or_owner());

-- ── Seed: spine phases from existing cycle_config windows ────────────────
-- Naive window columns hold the instant as UTC wall-clock (S5.1 convention)
-- → AT TIME ZONE 'UTC' converts losslessly. Open-mode cycles only.

INSERT INTO cycle_phases (cycle_id, phase_key, kind, position, starts_at, ends_at)
SELECT c.id, w.phase_key, 'spine', w.position,
       w.open_val AT TIME ZONE 'UTC',
       w.close_val AT TIME ZONE 'UTC'
FROM cycles c
JOIN cycle_config cc ON cc.cycle_id = c.id
CROSS JOIN LATERAL (
  VALUES
    ('problem_statement',    1::smallint, cc.problem_statement_open,    cc.problem_statement_close),
    ('voting',               2::smallint, cc.voting_open,               cc.voting_close),
    ('pod_forming',          3::smallint, cc.pod_registration_open,     cc.pod_registration_close),
    ('solution_proposal',    4::smallint, cc.solution_proposal_open,    cc.solution_proposal_close),
    ('solution_voting',      5::smallint, cc.solution_voting_open,      cc.solution_voting_close),
    ('project_registration', 6::smallint, cc.project_registration_open, cc.project_registration_close)
) AS w(phase_key, position, open_val, close_val)
WHERE c.mode = 'open'
  AND w.open_val IS NOT NULL
  AND w.close_val IS NOT NULL
  AND w.open_val < w.close_val
ON CONFLICT (cycle_id, phase_key) DO NOTHING;

-- pod_active_join (overlay): Meet-the-Pods marker → project registration
-- close (pod-registration.md; cycle-timeline.md "Pod active-join" row).

INSERT INTO cycle_phases (cycle_id, phase_key, kind, position, starts_at, ends_at)
SELECT c.id, 'pod_active_join', 'overlay', NULL,
       cc.phase_2_start AT TIME ZONE 'UTC',
       cc.project_registration_close AT TIME ZONE 'UTC'
FROM cycles c
JOIN cycle_config cc ON cc.cycle_id = c.id
WHERE c.mode = 'open'
  AND cc.phase_2_start IS NOT NULL
  AND cc.project_registration_close IS NOT NULL
  AND cc.phase_2_start < cc.project_registration_close
ON CONFLICT (cycle_id, phase_key) DO NOTHING;

-- ── Seed: the six anchor events for the live open HQ cycle ───────────────
-- Owner-confirmed Cycle 3 calendar (all ET; stored as instants). Applies to
-- the single active-or-upcoming open cycle with lab_id NULL — a no-op on
-- databases without one, and ON CONFLICT-safe on re-run.

INSERT INTO cycle_events (cycle_id, key, label, occurs_at)
SELECT c.id, e.key, e.label, e.occurs_at
FROM cycles c
CROSS JOIN (
  VALUES
    ('kickoff',           'Kickoff Summit',              '2026-07-14T18:00:00-04:00'::timestamptz),
    ('problem_sprint',    'Problem Sprint',              '2026-07-25T09:00:00-04:00'::timestamptz),
    ('meet_the_pods',     'Meet the Pods',               '2026-08-11T18:00:00-04:00'::timestamptz),
    ('hackathon',         'Hackathon — the Frame Sprint','2026-08-13T09:00:00-04:00'::timestamptz),
    ('meet_the_projects', 'Meet the Projects',           '2026-09-08T18:00:00-04:00'::timestamptz),
    ('summit',            'Showcase Summit',             '2026-10-13T18:00:00-04:00'::timestamptz)
) AS e(key, label, occurs_at)
WHERE c.mode = 'open'
  AND c.lab_id IS NULL
  AND c.status IN ('active', 'upcoming')
ON CONFLICT (cycle_id, key) DO NOTHING;
