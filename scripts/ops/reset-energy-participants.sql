-- =============================================================================
-- reset-energy-participants.sql — Clear Energy cycle non-owner data
-- =============================================================================
--
-- Purpose
-- -------
-- The Energy & Climate cohort was bulk-loaded via the spreadsheet→Postgres
-- migration, but most participants' data didn't land correctly. Plan: clear
-- their cycle-scoped data so participants re-register through the web form
-- and capture clean rows. Owners and admins are preserved.
--
-- Cycle identification is by NAME, not id, because dev and prod disagree:
--   * dev:  Energy & Climate has id=2
--   * prod: Energy & Climate has id=3
-- The script resolves the id from a name match (ILIKE '%Energy%').
--
-- What it deletes (Energy cycle only, non-owners only)
-- ----------------------------------------------------
--   pulse_checks            cycle_id = energy
--   nominations             cycle_id = energy   (table guarded — missing on dev)
--   votes                   cycle_id = energy   (problem-statement votes are cycle-scoped)
--   project_votes           cycle_id = energy
--   pod_memberships         pod in Energy pods
--   project_memberships     cycle_id = energy
--   moderator_assignments   cycle_id = energy
--   solution_proposals      cycle_id = energy
--   problem_statements      cycle_id = energy
--   invitations             cycle_id = energy   (ALL — re-issued by bulk-invite)
--   cycle_enrollments       cycle_id = energy   (non-owners)
--
-- What it INTENTIONALLY leaves alone
-- ----------------------------------
--   participants            row stays; will be updated on re-registration
--   participant_options     multi-cycle preferences; not Energy-specific
--   participant_permissions cross-cycle grants
--   pods, projects          structural setup; pods will have 0 members until
--                           people re-enroll
--   user_roles              owner/admin grants
--   auth.users              Supabase Auth identities — never touched
--
-- Two-pass dry-run pattern
-- ------------------------
-- This script ends with `ROLLBACK` by default. Run it once to read the
-- before-and-after counts, sanity-check the numbers, then:
--
--   1. Change the final `ROLLBACK` to `COMMIT` (single-line edit at the bottom)
--   2. Re-run against the SAME database
--   3. Change back to `ROLLBACK` before committing the file to git
--
-- Run via Supabase MCP (`mcp__supabase__execute_sql` for dev /
-- `mcp__supabase-prod__execute_sql` for prod) or via psql against the Session
-- Pooler endpoint.
--
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Pre-flight: resolve Energy cycle id by name
-- -----------------------------------------------------------------------------

CREATE TEMP TABLE _energy_cycle ON COMMIT DROP AS
SELECT id AS cycle_id, name
FROM cycles
WHERE name ILIKE '%Energy%';

DO $$
DECLARE
  n INT;
  energy_id INT;
  energy_name TEXT;
BEGIN
  SELECT COUNT(*), MAX(cycle_id), MAX(name) INTO n, energy_id, energy_name FROM _energy_cycle;
  IF n = 0 THEN
    RAISE EXCEPTION 'No cycle matches ILIKE ''%%Energy%%''. Aborting.';
  ELSIF n > 1 THEN
    RAISE EXCEPTION 'Multiple cycles match ILIKE ''%%Energy%%'' (% rows). Refusing to guess. Aborting.', n;
  END IF;
  RAISE NOTICE 'Target cycle resolved: id=% name=%', energy_id, energy_name;
END $$;

-- -----------------------------------------------------------------------------
-- Identify the targets
-- -----------------------------------------------------------------------------

CREATE TEMP TABLE _preserved_participants ON COMMIT DROP AS
SELECT DISTINCT participant_id
FROM user_roles
WHERE role IN ('owner', 'admin')
  AND revoked_at IS NULL
  AND participant_id IS NOT NULL;

CREATE TEMP TABLE _energy_non_owners ON COMMIT DROP AS
SELECT DISTINCT ce.participant_id
FROM cycle_enrollments ce
WHERE ce.cycle_id IN (SELECT cycle_id FROM _energy_cycle)
  AND ce.participant_id NOT IN (SELECT participant_id FROM _preserved_participants);

CREATE TEMP TABLE _energy_pods ON COMMIT DROP AS
SELECT id AS pod_id FROM pods WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle);

CREATE TEMP TABLE _energy_projects ON COMMIT DROP AS
SELECT pj.id AS project_id
FROM projects pj
WHERE pj.pod_id IN (SELECT pod_id FROM _energy_pods);

DO $$
DECLARE
  preserved INT; victims INT; pods_n INT; projects_n INT;
BEGIN
  SELECT COUNT(*) INTO preserved FROM _preserved_participants;
  SELECT COUNT(*) INTO victims   FROM _energy_non_owners;
  SELECT COUNT(*) INTO pods_n    FROM _energy_pods;
  SELECT COUNT(*) INTO projects_n FROM _energy_projects;
  RAISE NOTICE 'Pre-flight: % owners/admins preserved | % non-owner Energy participants targeted | % Energy pods | % Energy projects',
    preserved, victims, pods_n, projects_n;
END $$;

-- -----------------------------------------------------------------------------
-- BEFORE counts
-- -----------------------------------------------------------------------------

CREATE TEMP TABLE _before_counts (table_name TEXT, n BIGINT) ON COMMIT DROP;

INSERT INTO _before_counts
SELECT 'pulse_checks',           COUNT(*) FROM pulse_checks         WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle) AND participant_id IN (SELECT participant_id FROM _energy_non_owners)
UNION ALL SELECT 'votes',                COUNT(*) FROM votes               WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle) AND voter_id IN (SELECT participant_id FROM _energy_non_owners)
UNION ALL SELECT 'project_votes',        COUNT(*) FROM project_votes       WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle) AND voter_id IN (SELECT participant_id FROM _energy_non_owners)
UNION ALL SELECT 'pod_memberships',      COUNT(*) FROM pod_memberships     WHERE pod_id IN (SELECT pod_id FROM _energy_pods)         AND participant_id IN (SELECT participant_id FROM _energy_non_owners)
UNION ALL SELECT 'project_memberships',  COUNT(*) FROM project_memberships WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle) AND participant_id IN (SELECT participant_id FROM _energy_non_owners)
UNION ALL SELECT 'moderator_assignments',COUNT(*) FROM moderator_assignments WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle) AND participant_id IN (SELECT participant_id FROM _energy_non_owners)
UNION ALL SELECT 'solution_proposals',   COUNT(*) FROM solution_proposals  WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle) AND participant_id IN (SELECT participant_id FROM _energy_non_owners)
UNION ALL SELECT 'problem_statements',   COUNT(*) FROM problem_statements  WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle) AND participant_id IN (SELECT participant_id FROM _energy_non_owners)
UNION ALL SELECT 'invitations',          COUNT(*) FROM invitations         WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle)
UNION ALL SELECT 'cycle_enrollments',    COUNT(*) FROM cycle_enrollments   WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle) AND participant_id IN (SELECT participant_id FROM _energy_non_owners);

-- Append nominations count via dynamic SQL so the script parses on dev (where
-- the table is currently missing — see migration drift note in CLAUDE.md).
DO $$
DECLARE
  c BIGINT;
BEGIN
  IF to_regclass('public.nominations') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM nominations WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle) AND participant_id IN (SELECT participant_id FROM _energy_non_owners)' INTO c;
    INSERT INTO _before_counts VALUES ('nominations', c);
  ELSE
    INSERT INTO _before_counts VALUES ('nominations (missing on dev)', 0);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- DELETE in dependency order
-- -----------------------------------------------------------------------------

-- 1. Pulse-check data
DELETE FROM pulse_checks
 WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle)
   AND participant_id IN (SELECT participant_id FROM _energy_non_owners);

-- 1b. Nominations (guarded — missing on dev as of 2026-05-21)
DO $$
BEGIN
  IF to_regclass('public.nominations') IS NOT NULL THEN
    DELETE FROM nominations
     WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle)
       AND participant_id IN (SELECT participant_id FROM _energy_non_owners);
  ELSE
    RAISE NOTICE 'nominations table not present (dev drift) — skipping';
  END IF;
END $$;

-- 2. Voting data — both are cycle-scoped (not pod-scoped) in the actual schema
DELETE FROM votes
 WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle)
   AND voter_id IN (SELECT participant_id FROM _energy_non_owners);

DELETE FROM project_votes
 WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle)
   AND voter_id IN (SELECT participant_id FROM _energy_non_owners);

-- 3. Memberships
DELETE FROM pod_memberships
 WHERE pod_id IN (SELECT pod_id FROM _energy_pods)
   AND participant_id IN (SELECT participant_id FROM _energy_non_owners);

DELETE FROM project_memberships
 WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle)
   AND participant_id IN (SELECT participant_id FROM _energy_non_owners);

DELETE FROM moderator_assignments
 WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle)
   AND participant_id IN (SELECT participant_id FROM _energy_non_owners);

-- 4. Submissions
DELETE FROM solution_proposals
 WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle)
   AND participant_id IN (SELECT participant_id FROM _energy_non_owners);

DELETE FROM problem_statements
 WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle)
   AND participant_id IN (SELECT participant_id FROM _energy_non_owners);

-- 5. Invitations: clear ALL Energy invitations (re-issued by bulk-invite script)
DELETE FROM invitations
 WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle);

-- 6. Cycle enrollment — the "is this person in this cycle" row
DELETE FROM cycle_enrollments
 WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle)
   AND participant_id IN (SELECT participant_id FROM _energy_non_owners);

-- -----------------------------------------------------------------------------
-- AFTER report — every "after" should be 0
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  r RECORD;
  after_n BIGINT;
  total_deleted BIGINT := 0;
BEGIN
  RAISE NOTICE '--- Reset report ---';
  RAISE NOTICE 'Table                    | Before | After';
  RAISE NOTICE '-------------------------+--------+------';
  FOR r IN SELECT table_name, n AS before_n FROM _before_counts ORDER BY table_name LOOP
    -- nominations is handled separately (dynamic SQL); skip it here
    IF r.table_name LIKE 'nominations%' THEN
      IF to_regclass('public.nominations') IS NOT NULL THEN
        EXECUTE 'SELECT COUNT(*) FROM nominations WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle) AND participant_id IN (SELECT participant_id FROM _energy_non_owners)' INTO after_n;
      ELSE
        after_n := 0;
      END IF;
      RAISE NOTICE '% | % | %', rpad(r.table_name, 32), lpad(r.before_n::TEXT, 6), lpad(after_n::TEXT, 5);
      total_deleted := total_deleted + (r.before_n - after_n);
      CONTINUE;
    END IF;
    after_n := CASE r.table_name
      WHEN 'pulse_checks'         THEN (SELECT COUNT(*) FROM pulse_checks         WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle) AND participant_id IN (SELECT participant_id FROM _energy_non_owners))
      WHEN 'votes'                THEN (SELECT COUNT(*) FROM votes               WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle) AND voter_id IN (SELECT participant_id FROM _energy_non_owners))
      WHEN 'project_votes'        THEN (SELECT COUNT(*) FROM project_votes       WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle) AND voter_id IN (SELECT participant_id FROM _energy_non_owners))
      WHEN 'pod_memberships'      THEN (SELECT COUNT(*) FROM pod_memberships     WHERE pod_id IN (SELECT pod_id FROM _energy_pods)         AND participant_id IN (SELECT participant_id FROM _energy_non_owners))
      WHEN 'project_memberships'  THEN (SELECT COUNT(*) FROM project_memberships WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle) AND participant_id IN (SELECT participant_id FROM _energy_non_owners))
      WHEN 'moderator_assignments' THEN (SELECT COUNT(*) FROM moderator_assignments WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle) AND participant_id IN (SELECT participant_id FROM _energy_non_owners))
      WHEN 'solution_proposals'   THEN (SELECT COUNT(*) FROM solution_proposals  WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle) AND participant_id IN (SELECT participant_id FROM _energy_non_owners))
      WHEN 'problem_statements'   THEN (SELECT COUNT(*) FROM problem_statements  WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle) AND participant_id IN (SELECT participant_id FROM _energy_non_owners))
      WHEN 'invitations'          THEN (SELECT COUNT(*) FROM invitations         WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle))
      WHEN 'cycle_enrollments'    THEN (SELECT COUNT(*) FROM cycle_enrollments   WHERE cycle_id IN (SELECT cycle_id FROM _energy_cycle) AND participant_id IN (SELECT participant_id FROM _energy_non_owners))
    END;
    RAISE NOTICE '% | % | %', rpad(r.table_name, 24), lpad(r.before_n::TEXT, 6), lpad(after_n::TEXT, 5);
    total_deleted := total_deleted + (r.before_n - after_n);
  END LOOP;
  RAISE NOTICE '-------------------------+--------+------';
  RAISE NOTICE 'Total rows removed: %', total_deleted;
END $$;

-- -----------------------------------------------------------------------------
-- DEFAULT: rollback so this script is safe to dry-run.
-- After reviewing the report, change `ROLLBACK` to `COMMIT` and re-run.
-- -----------------------------------------------------------------------------

ROLLBACK;
-- COMMIT;
