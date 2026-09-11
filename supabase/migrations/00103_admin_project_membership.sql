-- 00103_admin_project_membership.sql — admins can place and move people on projects.
--
-- WHY: there was no admin path onto a project at all. Members self-register
-- (app/api/projects/[project_id]/register/route.ts) and admins can move people
-- between PODS (app/api/admin/pods/…), but nothing could put someone on a
-- project, so operator fixes meant raw SQL.
--
-- The schema makes both operations multi-table and invariant-bound:
--   * projects.pod_id is NOT NULL — a project lives in exactly one pod, so
--     joining a project MUST imply joining its pod or the rosters disagree
--     (and poderators read pods, which is the point of the ask).
--   * one_active_project_per_cycle (00001) — at most one active project per
--     participant per cycle. A "move" is therefore genuinely a move: the old
--     row has to close in the same transaction the new one opens, or the
--     partial unique index rejects the second row.
--   * UNIQUE(participant_id, project_id) — rejoining a project you previously
--     left must REACTIVATE the existing row, never insert a second one.
--   * cycle_config.pod_limit (default 1) — a cross-pod move must close the old
--     pod membership or the new one breaches the cap.
--
-- Sequenced app-level writes cannot hold that together: a cap rejection on the
-- project would leave someone stranded in a pod they were only added to for
-- that project. Hence SECURITY DEFINER RPCs — one transaction, all-or-nothing.
--
-- CALLER CONTRACT (same as 00079's): these are is_admin()-gated and is_admin()
-- reads auth.uid(), so they MUST be invoked through the USER-scoped client (the
-- request's cookie session), NEVER the service-role client — the service role
-- has no auth.uid(), so is_admin() would return false and the function would
-- RAISE, and the audit actor would resolve NULL.

-- ── 1. Admin audit trail ───────────────────────────────────────────────────
-- Deliberately NOT owner_actions (00078): that table is owner-only by RLS with
-- an action vocabulary CHECK-locked to lifecycle verbs. Roster edits are an
-- admin concern with a different shape (from → to), so they get their own table.
-- This also gives the admin pod routes somewhere to land when their documented
-- "KNOWN GAP — admin audit trail" is finally closed.
CREATE TABLE IF NOT EXISTS admin_actions (
  id                   bigserial PRIMARY KEY,
  actor_participant_id integer,          -- not FK: the log outlives the actor
  actor_email          varchar,
  action               varchar NOT NULL CHECK (action IN ('project_add', 'project_move')),
  participant_id       integer,          -- the person acted upon
  participant_label    varchar,
  cycle_id             integer,
  from_project_id      integer,
  to_project_id        integer,
  from_pod_id          integer,
  to_pod_id            integer,
  cap_overridden       boolean NOT NULL DEFAULT false,
  reason               varchar,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_participant ON admin_actions (participant_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions (created_at DESC);

-- Admin-readable. No write policy: every write happens inside the SECURITY
-- DEFINER RPCs below, which bypass RLS — so no client can forge an audit row.
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_actions_admin_read ON admin_actions;
CREATE POLICY admin_actions_admin_read ON admin_actions FOR SELECT USING (is_admin());

COMMENT ON TABLE admin_actions IS
  'Audit log for admin roster edits (project add / move). Sibling to owner_actions (00078), which stays owner-only lifecycle verbs.';

-- ── 2. A deliberate, narrow hole in the project_max cap ────────────────────
-- OWNER DECISION (2026-09-11): admins may exceed project_max with confirmation.
--
-- 00101 put the cap in the DATABASE precisely so the app could not be raced
-- past it, and a SECURITY DEFINER function does not escape its own triggers.
-- So the override is an explicit, transaction-scoped GUC that ONLY the admin
-- RPCs below set, via SET LOCAL, and only when the caller passes p_override.
--
-- This weakens 00101 on purpose, and only here. Every other path — member
-- self-registration, withdraw-then-rejoin, concurrent join bursts at a
-- relaunch — still hits the hard wall, because none of them set the GUC.
-- current_setting(..., true) returns NULL when unset, so the default is closed.
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

  -- The admin override (00103). Transaction-scoped and set only by the admin
  -- RPCs; unset for every other caller, so the cap holds everywhere else.
  IF coalesce(current_setting('app.admin_cap_override', true), '') = 'on' THEN
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

-- ── 3. Shared helper: put someone on a project and into its pod ────────────
-- Not exposed to clients. Assumes the caller has already authorized.
CREATE OR REPLACE FUNCTION _place_on_project(p_participant integer, p_project integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pod   integer;
  v_cycle integer;
BEGIN
  SELECT pod_id, cycle_id INTO v_pod, v_cycle FROM projects WHERE id = p_project;
  IF v_pod IS NULL THEN
    RAISE EXCEPTION 'No such project: %', p_project;
  END IF;

  -- Pod first. UNIQUE(participant_id, pod_id) means a prior membership is
  -- REACTIVATED (joined_at preserved — the architecture brief §5 invariant),
  -- never duplicated.
  INSERT INTO pod_memberships (participant_id, pod_id)
  VALUES (p_participant, v_pod)
  ON CONFLICT (participant_id, pod_id)
  DO UPDATE SET inactive_at = NULL
  WHERE pod_memberships.inactive_at IS NOT NULL;

  -- Then the project. Same reactivate-don't-duplicate rule via
  -- UNIQUE(participant_id, project_id).
  INSERT INTO project_memberships (participant_id, project_id, cycle_id)
  VALUES (p_participant, p_project, v_cycle)
  ON CONFLICT (participant_id, project_id)
  DO UPDATE SET left_at = NULL, registered_at = now()
  WHERE project_memberships.left_at IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION _place_on_project(integer, integer) FROM public;

-- ── 4. admin_add_to_project ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_add_to_project(
  p_participant integer,
  p_project     integer,
  p_reason      varchar DEFAULT NULL,
  p_override    boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pod   integer;
  v_cycle integer;
  v_actor integer;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admin_add_to_project: admins only'; END IF;

  SELECT pod_id, cycle_id INTO v_pod, v_cycle FROM projects WHERE id = p_project;
  IF v_pod IS NULL THEN RAISE EXCEPTION 'No such project: %', p_project; END IF;

  -- One active project per cycle (00001). Say so plainly rather than letting
  -- the unique index surface as a raw constraint error — the fix is Move.
  IF EXISTS (SELECT 1 FROM project_memberships
              WHERE participant_id = p_participant AND cycle_id = v_cycle
                AND left_at IS NULL AND project_id <> p_project) THEN
    RAISE EXCEPTION 'This person is already on another project in this cycle. Use Move instead.';
  END IF;

  IF p_override THEN
    PERFORM set_config('app.admin_cap_override', 'on', true);  -- true = SET LOCAL
  END IF;

  PERFORM _place_on_project(p_participant, p_project);

  SELECT id INTO v_actor FROM participants WHERE auth_user_id = auth.uid();
  INSERT INTO admin_actions (actor_participant_id, actor_email, action, participant_id,
                             participant_label, cycle_id, to_project_id, to_pod_id,
                             cap_overridden, reason)
  VALUES (v_actor, (SELECT email FROM participants WHERE id = v_actor), 'project_add',
          p_participant, (SELECT email FROM participants WHERE id = p_participant),
          v_cycle, p_project, v_pod, coalesce(p_override, false), p_reason);
END;
$$;
REVOKE ALL ON FUNCTION admin_add_to_project(integer, integer, varchar, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_add_to_project(integer, integer, varchar, boolean) TO authenticated;

-- ── 5. admin_move_project ──────────────────────────────────────────────────
-- The destination is the only project named by the caller; the source is
-- derived from the participant's one active membership, so the UI cannot send
-- a stale "from" and move the wrong row.
CREATE OR REPLACE FUNCTION admin_move_project(
  p_participant integer,
  p_to_project  integer,
  p_reason      varchar DEFAULT NULL,
  p_override    boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_to_pod    integer;
  v_cycle     integer;
  v_from_proj integer;
  v_from_pod  integer;
  v_actor     integer;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admin_move_project: admins only'; END IF;

  SELECT pod_id, cycle_id INTO v_to_pod, v_cycle FROM projects WHERE id = p_to_project;
  IF v_to_pod IS NULL THEN RAISE EXCEPTION 'No such project: %', p_to_project; END IF;

  SELECT pm.project_id, pr.pod_id INTO v_from_proj, v_from_pod
    FROM project_memberships pm
    JOIN projects pr ON pr.id = pm.project_id
   WHERE pm.participant_id = p_participant AND pm.cycle_id = v_cycle AND pm.left_at IS NULL;

  IF v_from_proj IS NULL THEN
    RAISE EXCEPTION 'This person is not on a project in this cycle. Use Add instead.';
  END IF;
  IF v_from_proj = p_to_project THEN
    RAISE EXCEPTION 'This person is already on that project.';
  END IF;

  -- Close the old membership FIRST: one_active_project_per_cycle would
  -- otherwise reject the new row. Same transaction, so they are never
  -- half-moved.
  UPDATE project_memberships SET left_at = now()
   WHERE participant_id = p_participant AND project_id = v_from_proj AND left_at IS NULL;

  -- OWNER DECISION (2026-09-11): a cross-pod move closes the old pod
  -- membership. cycle_config.pod_limit defaults to 1, so keeping both would
  -- breach the cap; and a roster with no project in it is a lie.
  IF v_from_pod IS DISTINCT FROM v_to_pod THEN
    UPDATE pod_memberships SET inactive_at = now()
     WHERE participant_id = p_participant AND pod_id = v_from_pod AND inactive_at IS NULL;
  END IF;

  -- moderator_assignments are deliberately untouched. Membership and authority
  -- are separate grants, and per the owner a moderator is never a project
  -- member in the pod they moderate — so there is nothing to reconcile, and if
  -- it ever happens the move leaves their authority intact rather than
  -- silently revoking it during a roster edit.

  IF p_override THEN
    PERFORM set_config('app.admin_cap_override', 'on', true);
  END IF;

  PERFORM _place_on_project(p_participant, p_to_project);

  SELECT id INTO v_actor FROM participants WHERE auth_user_id = auth.uid();
  INSERT INTO admin_actions (actor_participant_id, actor_email, action, participant_id,
                             participant_label, cycle_id, from_project_id, to_project_id,
                             from_pod_id, to_pod_id, cap_overridden, reason)
  VALUES (v_actor, (SELECT email FROM participants WHERE id = v_actor), 'project_move',
          p_participant, (SELECT email FROM participants WHERE id = p_participant),
          v_cycle, v_from_proj, p_to_project, v_from_pod, v_to_pod,
          coalesce(p_override, false), p_reason);
END;
$$;
REVOKE ALL ON FUNCTION admin_move_project(integer, integer, varchar, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_move_project(integer, integer, varchar, boolean) TO authenticated;

-- DOWN:
--   DROP FUNCTION IF EXISTS admin_move_project(integer, integer, varchar, boolean);
--   DROP FUNCTION IF EXISTS admin_add_to_project(integer, integer, varchar, boolean);
--   DROP FUNCTION IF EXISTS _place_on_project(integer, integer);
--   DROP TABLE IF EXISTS admin_actions;
--   -- and re-apply 00101's body to remove the override branch from the trigger.
