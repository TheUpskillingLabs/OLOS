-- 00037_schema_hardening.sql
--
-- Phase 0.5 of docs/audit/IMPROVEMENT_ROADMAP.md, spec in
-- docs/audit/DATA_ARCHITECTURE.md §3: mechanical robustness fixes, no
-- product change. Four parts:
--   1. CHECK constraints on the core lifecycle status columns (the oldest
--      tables predate the CHECK convention the newer tables follow). Added
--      NOT VALID so legacy rows are never scanned/failed; new writes are
--      enforced immediately. VALIDATE CONSTRAINT is a follow-up once prod
--      values are confirmed clean.
--   2. A single set_updated_at() trigger everywhere updated_at exists —
--      previously 100% app-managed (any forgotten route or direct SQL left
--      it stale).
--   3. search_path pinned on the SECURITY DEFINER RLS helpers (Supabase
--      function_search_path_mutable advisory) + can_write_cycles() as the
--      honestly-named alias for is_admin_or_owner() (which since 00009 is
--      really has_permission('cycles:write') — owner, admin AND developer).
--      New policies should use can_write_cycles(); old ones migrate
--      opportunistically.
--   4. Missing indexes on known query patterns (vote lookups, moderator
--      cycle scoping, published-content filters, pulse date scans).
--
-- DOWN: ALTER TABLE ... DROP CONSTRAINT <name>; DROP TRIGGER ... ;
--       DROP FUNCTION set_updated_at(), can_write_cycles(); DROP INDEX ...;
--       (search_path pins are harmless to leave).

-- ── 1. Status CHECKs (NOT VALID — new writes only) ──────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cycles_status_check') THEN
    ALTER TABLE cycles
      ADD CONSTRAINT cycles_status_check
      CHECK (status IN ('draft', 'active', 'closed')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pods_status_check') THEN
    ALTER TABLE pods
      ADD CONSTRAINT pods_status_check
      CHECK (status IN ('forming', 'active', 'inactive')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_status_check') THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_status_check
      CHECK (status IN ('forming', 'active', 'inactive')) NOT VALID;
  END IF;

  -- 'stepped_back' is included ahead of its consumer (roadmap Phase 4's
  -- leaving-well flow) so that work needs no schema pass — the reconciler
  -- gains the state before any route writes it.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cycle_enrollments_status_check') THEN
    ALTER TABLE cycle_enrollments
      ADD CONSTRAINT cycle_enrollments_status_check
      CHECK (status IN ('inactive', 'active', 'revoked', 'stepped_back')) NOT VALID;
  END IF;
END $$;

-- ── 2. updated_at trigger ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cycles', 'cycle_config', 'pods', 'projects',
    'events', 'resources', 'metros', 'moderator_ui_state'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;

-- ── 3. Helper hardening + honest alias ──────────────────────────────────

ALTER FUNCTION is_admin_or_owner() SET search_path = public;
ALTER FUNCTION current_participant_id() SET search_path = public;
ALTER FUNCTION has_permission(TEXT) SET search_path = public;

CREATE OR REPLACE FUNCTION can_write_cycles()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT has_permission('cycles:write');
$$;

-- ── 4. Missing indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes(voter_id);
CREATE INDEX IF NOT EXISTS idx_project_votes_voter ON project_votes(voter_id);
CREATE INDEX IF NOT EXISTS idx_project_votes_proposal ON project_votes(solution_proposal_id);
CREATE INDEX IF NOT EXISTS idx_moderator_assignments_cycle ON moderator_assignments(cycle_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_start_at ON events(start_at);
CREATE INDEX IF NOT EXISTS idx_pulse_checks_participant_scheduled
  ON pulse_checks(participant_id, scheduled_date);
