-- 00068_pods_local.sql
-- "Pods are local only" (docs/LOCAL_LABS.md). 00067 shipped pods.lab_id as a
-- HOST TAG — voting was global and cross-metro joins were allowed. The owner
-- has since closed that caveat: a pod belongs to exactly one Local Lab and
-- only that lab's members participate in it. Two schema changes carry it:
--
--   1. problem_statements.metro_id — a SNAPSHOT of the submitter's lab at
--      submission time. Per-lab voting/formation (the app) reads this instead
--      of re-deriving the submitter's *current* metro (which drifts if the
--      member later changes labs). Nullable + FK to metros; NULL = the
--      grandfathered HQ bucket (every live statement on dev, whose submitters
--      are metro-less).
--
--   2. A membership FENCE on pod_memberships — the DB twin of the app-level
--      guards. For an OPEN-mode cycle pod carrying a lab, an ACTIVE membership
--      requires participants.metro_id = pods.lab_id. Org runs (invite-only,
--      cross-lab by design) and HQ/grandfathered NULL-lab pods are exempt.
--
-- metros stays service-role-only for writes (no new RLS policy): the
-- "start a waitlist" path creates metros via a service-role route, matching
-- the existing metro_waitlist_signups + getMetros model. No anon write path.
--
-- Inert on current dev data: every live pod is lab_id=NULL, so the fence
-- never fires until the first lab-tagged pod forms.
--
-- Idempotent + re-runnable.
--
-- DOWN:
--   DROP TRIGGER IF EXISTS enforce_local_pod_membership_trg ON pod_memberships;
--   DROP FUNCTION IF EXISTS enforce_local_pod_membership();
--   DROP INDEX IF EXISTS idx_problem_statements_metro;
--   ALTER TABLE problem_statements DROP COLUMN IF EXISTS metro_id;

-- ── 1. Statement lab snapshot ────────────────────────────────────────────
ALTER TABLE problem_statements
  ADD COLUMN IF NOT EXISTS metro_id INT REFERENCES metros(id);

-- Backfill from the submitter's current lab. (All live submitters are
-- metro-less today, so this sets NULL — the grandfathered HQ bucket.)
UPDATE problem_statements ps
SET metro_id = p.metro_id
FROM participants p
WHERE ps.participant_id = p.id
  AND ps.metro_id IS DISTINCT FROM p.metro_id;

CREATE INDEX IF NOT EXISTS idx_problem_statements_metro
  ON problem_statements(metro_id);

-- ── 2. Pod-membership fence ──────────────────────────────────────────────
-- SECURITY DEFINER so the checks read authoritative rows regardless of the
-- calling client's RLS (pod_memberships writes are service-role today, but
-- the fence must hold for any writer). search_path pinned per repo convention.
CREATE OR REPLACE FUNCTION enforce_local_pod_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lab_id INT;
  v_mode   TEXT;
  v_metro  INT;
BEGIN
  -- Validate ONLY on entry into the active state: a fresh INSERT, or a
  -- soft-deleted row being reactivated. A soft-delete (inactive_at set) or
  -- any other update to an already-active row is exempt, so grandfathered
  -- rows, close-out, and the reconciler's reactivations never wedge.
  IF NEW.inactive_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.inactive_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.lab_id, c.mode
    INTO v_lab_id, v_mode
  FROM pods p
  JOIN cycles c ON c.id = p.cycle_id
  WHERE p.id = NEW.pod_id;

  -- Exempt: HQ/grandfathered pods (no lab) and org runs (invite-only,
  -- legitimately cross-lab). Pods are local only within the open track.
  IF v_lab_id IS NULL OR v_mode IS DISTINCT FROM 'open' THEN
    RETURN NEW;
  END IF;

  SELECT metro_id INTO v_metro
  FROM participants
  WHERE id = NEW.participant_id;

  IF v_metro IS DISTINCT FROM v_lab_id THEN
    RAISE EXCEPTION
      'pod is local to its lab: participant % (lab %) cannot join pod % (lab %)',
      NEW.participant_id, v_metro, NEW.pod_id, v_lab_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_local_pod_membership_trg ON pod_memberships;
CREATE TRIGGER enforce_local_pod_membership_trg
  BEFORE INSERT OR UPDATE ON pod_memberships
  FOR EACH ROW
  EXECUTE FUNCTION enforce_local_pod_membership();
