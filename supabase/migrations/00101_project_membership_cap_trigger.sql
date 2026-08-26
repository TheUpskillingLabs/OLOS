-- 00101_project_membership_cap_trigger.sql
--
-- WHY: the 2026-08-26 direct-registration relaunch (see
-- scripts/ops/open-project-registration-2026-08-26.md) opens every submitted
-- pitch to cycle-wide self-registration with a hard cap of
-- cycle_config.project_max members per project. The app-level cap check in
-- app/api/projects/[project_id]/register/route.ts is count-then-insert, so a
-- join burst at reopen (the announced relaunch makes one likely) can
-- oversubscribe a project: two requests at count 4 both read "room left" and
-- both insert. The 1-project-per-cycle rule already has a DB backstop (the
-- one_active_project_per_cycle partial unique index, 00001); this gives the
-- cap the same guarantee.
--
-- The trigger fires on INSERT of an active row and on reactivation (an
-- UPDATE flipping left_at from set → NULL, the withdraw-then-rejoin path).
-- It takes a row lock on the parent project so concurrent joins serialize;
-- with ~5-person projects the contention window is a few milliseconds.
--
-- SECURITY DEFINER: registration writes arrive via the service role, but an
-- admin editing memberships through the user client must not have the
-- cap-count SELECT filtered by RLS. Owned by the migration role (postgres),
-- search_path pinned per the usual SECURITY DEFINER hygiene.
--
-- A cycle without a cycle_config row (or a NULL project_max) is uncapped —
-- matching the app check, which only rejects when config is present.
--
-- DOWN:
--   DROP TRIGGER IF EXISTS project_membership_cap ON project_memberships;
--   DROP FUNCTION IF EXISTS enforce_project_membership_cap();

CREATE OR REPLACE FUNCTION enforce_project_membership_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cap smallint;
  active_count int;
BEGIN
  -- Only (re)activations are capped.
  IF NEW.left_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.left_at IS NULL THEN
    -- Row was already active; not a join.
    RETURN NEW;
  END IF;

  -- Serialize concurrent joins on the same project so two requests can't
  -- both pass the count below.
  PERFORM 1 FROM projects WHERE id = NEW.project_id FOR UPDATE;

  SELECT cc.project_max INTO cap
  FROM cycle_config cc
  WHERE cc.cycle_id = NEW.cycle_id;

  IF cap IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO active_count
  FROM project_memberships pm
  WHERE pm.project_id = NEW.project_id
    AND pm.left_at IS NULL
    AND pm.id IS DISTINCT FROM NEW.id;

  IF active_count >= cap THEN
    RAISE EXCEPTION 'This project has reached its maximum registrant count.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_membership_cap ON project_memberships;
CREATE TRIGGER project_membership_cap
  BEFORE INSERT OR UPDATE OF left_at ON project_memberships
  FOR EACH ROW
  EXECUTE FUNCTION enforce_project_membership_cap();
