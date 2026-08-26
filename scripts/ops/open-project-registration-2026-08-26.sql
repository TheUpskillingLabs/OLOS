-- Open project registration to ALL submitted pitches (2026-08-26 incident).
-- Run in Supabase Studio. See open-project-registration-2026-08-26.md for the
-- full runbook and the incident write-up.
--
-- WHAT THIS DOES, in one transaction:
--   1. Promotes every submitted solution_proposal in the cycle to a
--      registerable project (status 'forming') — bypassing the vote-tally
--      shortlist, per the owner decision to abandon solution voting for this
--      cycle. Idempotent: proposals that already have a project are skipped.
--   2. Closes the solution_voting window (the vote is abandoned) and opens
--      project_registration now, closing at the time you set below. Sets
--      project_max = 5 (owner decision; project_min stays 3 = viability).
--   3. Mirrors the same changes into cycle_phases. This is REQUIRED, not
--      optional: the API write gate (lib/auth/windows.ts) reads cycle_phases
--      FIRST and only falls back to the cycle_config columns, while most
--      pages read the cycle_config columns directly. Editing only one of the
--      two leaves the page saying "open" while the Join button 403s (or vice
--      versa). syncPhasesFromConfig() only runs from the app's API writers,
--      never on direct SQL edits — so this script does the sync by hand.
--
-- CONVENTION WARNING: the cycle_config window columns are TIMESTAMP WITHOUT
-- TIME ZONE holding the instant AS UTC (lib/cycles/lab-time.ts, S5.1).
-- "Sept 1, 11:59 PM ET (EDT, UTC-4)" must be written '2026-09-02T03:59:00'.
-- cycle_phases columns are TIMESTAMPTZ; the conversions below handle that.

BEGIN;

-- ── EDIT THESE TWO VALUES, THEN RUN ─────────────────────────────────────────
CREATE TEMP TABLE _params AS
SELECT
  0::int AS cycle_id,  -- << the live cycle id (confirm with the runbook diagnostics first)
  '2026-09-02T03:59:00'::timestamp AS registration_close_utc;  -- << window close, NAIVE UTC
-- ────────────────────────────────────────────────────────────────────────────

-- Abort loudly if the cycle id was left at the placeholder / doesn't exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cycles c JOIN _params p ON c.id = p.cycle_id
  ) THEN
    RAISE EXCEPTION 'cycle_id in _params does not exist — edit the EDIT THESE VALUES block';
  END IF;
END $$;

-- 1. Promote every submitted pitch to a 'forming' project.
--    Name precedence mirrors extractProposalText (lib/projects/shortlist.ts),
--    title-ish fields first because projects.name is VARCHAR(40).
INSERT INTO projects (cycle_id, pod_id, solution_proposal_id, name, status)
SELECT
  sp.cycle_id,
  sp.pod_id,
  sp.id,
  left(trim(coalesce(
    nullif(sp.proposal_data->>'title', ''),
    nullif(sp.proposal_data->>'name', ''),
    nullif(sp.proposal_data->>'description', ''),
    nullif(sp.proposal_data->>'project_hypothesis', ''),
    nullif(sp.proposal_text, ''),
    'Project ' || sp.id
  )), 40),
  'forming'
FROM solution_proposals sp
JOIN _params p ON sp.cycle_id = p.cycle_id
WHERE NOT EXISTS (
  SELECT 1 FROM projects pr WHERE pr.solution_proposal_id = sp.id
);

-- 2. cycle_config: end the abandoned vote, open registration, cap at 5.
UPDATE cycle_config cc
SET solution_voting_close      = least(cc.solution_voting_close, now() AT TIME ZONE 'UTC'),
    project_registration_open  = now() AT TIME ZONE 'UTC',
    project_registration_close = p.registration_close_utc,
    project_max                = 5,
    updated_at                 = now()
FROM _params p
WHERE cc.cycle_id = p.cycle_id;

-- 3. cycle_phases mirror (the API gate's primary source).
--    solution_voting: never started → delete the row; started → end it now.
DELETE FROM cycle_phases cp
USING _params p
WHERE cp.cycle_id = p.cycle_id
  AND cp.phase_key = 'solution_voting'
  AND cp.starts_at >= now();

UPDATE cycle_phases cp
SET ends_at = least(cp.ends_at, now())
FROM _params p
WHERE cp.cycle_id = p.cycle_id
  AND cp.phase_key = 'solution_voting'
  AND cp.starts_at < now();

--    project_registration: open now, close at the configured time.
INSERT INTO cycle_phases (cycle_id, phase_key, kind, position, starts_at, ends_at)
SELECT p.cycle_id, 'project_registration', 'spine', 6,
       now(), p.registration_close_utc AT TIME ZONE 'UTC'
FROM _params p
ON CONFLICT (cycle_id, phase_key) DO UPDATE
SET starts_at = EXCLUDED.starts_at,
    ends_at   = EXCLUDED.ends_at;

--    pod_active_join overlay derives its end from project_registration_close
--    (lib/cycles/schedule.ts) — keep it consistent so the next config-form
--    save doesn't surprise anyone.
UPDATE cycle_phases cp
SET ends_at = p.registration_close_utc AT TIME ZONE 'UTC'
FROM _params p
WHERE cp.cycle_id = p.cycle_id
  AND cp.phase_key = 'pod_active_join'
  AND cp.starts_at < p.registration_close_utc AT TIME ZONE 'UTC';

COMMIT;

-- ── VERIFY (same run; the temp _params table is still in session) ───────────
-- Studio executes the script atomically, so the transaction above has
-- committed by the time these run. Run the runbook's step-1 diagnostics FIRST
-- and record the output; the runbook has the revert SQL if these checks come
-- back wrong. (psql users can instead move COMMIT below the checks and verify
-- interactively before committing.)

-- (a) Every pitch has a project; every project in the cycle is joinable.
SELECT
  (SELECT count(*) FROM solution_proposals sp JOIN _params p ON sp.cycle_id = p.cycle_id) AS pitches,
  (SELECT count(*) FROM projects pr JOIN _params p ON pr.cycle_id = p.cycle_id)           AS projects,
  (SELECT count(*) FROM projects pr JOIN _params p ON pr.cycle_id = p.cycle_id
    WHERE pr.status IN ('forming', 'active'))                                             AS joinable;

-- (b) The registration window reads OPEN on both sources the app consults.
SELECT
  cc.project_registration_open,
  cc.project_registration_close,
  (now() AT TIME ZONE 'UTC') BETWEEN cc.project_registration_open
                                 AND cc.project_registration_close AS config_open,
  cp.starts_at,
  cp.ends_at,
  now() >= cp.starts_at AND now() < cp.ends_at                     AS phase_open,
  cc.project_max,
  cc.project_min
FROM cycle_config cc
JOIN _params p ON cc.cycle_id = p.cycle_id
LEFT JOIN cycle_phases cp
  ON cp.cycle_id = cc.cycle_id AND cp.phase_key = 'project_registration';

-- (c) Solution voting reads CLOSED on both sources.
SELECT
  cc.solution_voting_open,
  cc.solution_voting_close,
  cp.starts_at,
  cp.ends_at,
  cp.id IS NULL OR now() >= cp.ends_at AS phase_closed
FROM cycle_config cc
JOIN _params p ON cc.cycle_id = p.cycle_id
LEFT JOIN cycle_phases cp
  ON cp.cycle_id = cc.cycle_id AND cp.phase_key = 'solution_voting';

-- (d) The project names that members will see (eyeball for junk).
SELECT pr.id, pr.pod_id, pr.name, pr.status
FROM projects pr
JOIN _params p ON pr.cycle_id = p.cycle_id
ORDER BY pr.pod_id, pr.id;
