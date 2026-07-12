-- 00080_entity_reset_rpcs.sql — owner lifecycle management, Phase 2 (cycles/pods/projects)
--
-- WHY: owners can now RESET a cycle, pod, or project — "wipe dependents + re-seed the
-- shell to defaults" (the user's chosen reset semantics). The entity row is kept; its
-- descendants are torn down FK-safely and its own state returns to the pristine default
-- (cycle → 'draft' + fresh cycle_config; pod/project → 'forming'). Archive (reversible)
-- and hard-delete stay elsewhere: archive is TS helpers (lib/owner/archive.ts), and hard
-- row-deletion of these big entities is deliberately NOT offered (owner decision — only
-- user profiles are hard-deletable).
--
-- All three are is_owner()-gated SECURITY DEFINER, invoked through the USER client (their
-- gate reads auth.uid() — see 00079's caller contract), and each writes an owner_actions
-- row (00078) in the same transaction. Preserved on reset (NOT wiped): commons research
-- (field_surveys + answers), the authority audit trail (access_revocations), and global/
-- cross-cycle authority (participant_roles rows not scoped to this cycle/pod/project).
--
-- FK order derives from the live constraint graph (all NO ACTION except nudge_dismissals):
-- referencing rows are deleted before the rows they reference. SCHEMA-CHANGE NOTE: a new
-- table referencing cycles/pods/projects must be slotted into these functions — audit the
-- FK graph on any such migration (same standing obligation as delete_participant).

-- ── reset_project: clear the project's team, keep the shell ──
CREATE OR REPLACE FUNCTION reset_project(target_id integer, why varchar DEFAULT 'owner_reset')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_label varchar;
BEGIN
  IF NOT is_owner() THEN RAISE EXCEPTION 'reset_project: owner (super admin) only'; END IF;
  SELECT name INTO target_label FROM projects WHERE id = target_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'reset_project: no such project %', target_id; END IF;

  DELETE FROM project_memberships   WHERE project_id = target_id;
  DELETE FROM project_roles         WHERE project_id = target_id;
  DELETE FROM project_subscriptions WHERE project_id = target_id;
  DELETE FROM participant_roles     WHERE project_id = target_id;   -- project-scoped grants (DRI/contributor)
  UPDATE projects SET status = 'forming' WHERE id = target_id;

  INSERT INTO owner_actions (actor_participant_id, actor_email, entity_type, entity_id, entity_label, action, reason)
  VALUES ((SELECT id FROM participants WHERE auth_user_id = auth.uid()),
          (SELECT email FROM participants WHERE auth_user_id = auth.uid()),
          'projects', target_id::varchar, target_label, 'reset', why);
END;
$$;
REVOKE ALL ON FUNCTION reset_project(integer, varchar) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION reset_project(integer, varchar) TO authenticated;

-- ── reset_pod: wipe the pod's projects + solutions + members, keep the shell ──
CREATE OR REPLACE FUNCTION reset_pod(target_id integer, why varchar DEFAULT 'owner_reset')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_label varchar;
BEGIN
  IF NOT is_owner() THEN RAISE EXCEPTION 'reset_pod: owner (super admin) only'; END IF;
  SELECT name INTO target_label FROM pods WHERE id = target_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'reset_pod: no such pod %', target_id; END IF;

  -- Project subtree of this pod (deepest refs first).
  UPDATE projects SET forked_from_project_id = NULL
    WHERE forked_from_project_id IN (SELECT id FROM projects WHERE pod_id = target_id);
  DELETE FROM project_memberships   WHERE project_id IN (SELECT id FROM projects WHERE pod_id = target_id);
  DELETE FROM project_roles         WHERE project_id IN (SELECT id FROM projects WHERE pod_id = target_id);
  DELETE FROM project_subscriptions WHERE project_id IN (SELECT id FROM projects WHERE pod_id = target_id);
  DELETE FROM participant_roles     WHERE project_id IN (SELECT id FROM projects WHERE pod_id = target_id);
  DELETE FROM project_votes         WHERE pod_id = target_id;
  DELETE FROM projects              WHERE pod_id = target_id;
  DELETE FROM solution_proposals    WHERE pod_id = target_id;
  -- Pod membership / moderator / poderator scope (the pod row is kept).
  DELETE FROM moderator_assignments WHERE pod_id = target_id;
  DELETE FROM pod_memberships       WHERE pod_id = target_id;
  DELETE FROM nudge_dismissals      WHERE pod_id = target_id;
  DELETE FROM participant_roles     WHERE pod_id = target_id;
  UPDATE pods SET status = 'forming' WHERE id = target_id;

  INSERT INTO owner_actions (actor_participant_id, actor_email, entity_type, entity_id, entity_label, action, reason)
  VALUES ((SELECT id FROM participants WHERE auth_user_id = auth.uid()),
          (SELECT email FROM participants WHERE auth_user_id = auth.uid()),
          'pods', target_id::varchar, target_label, 'reset', why);
END;
$$;
REVOKE ALL ON FUNCTION reset_pod(integer, varchar) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION reset_pod(integer, varchar) TO authenticated;

-- ── reset_cycle: tear the cohort back to a pristine draft, keep the cycle + config shell ──
CREATE OR REPLACE FUNCTION reset_cycle(target_id integer, why varchar DEFAULT 'owner_reset')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_label varchar;
BEGIN
  IF NOT is_owner() THEN RAISE EXCEPTION 'reset_cycle: owner (super admin) only'; END IF;
  SELECT name INTO target_label FROM cycles WHERE id = target_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'reset_cycle: no such cycle %', target_id; END IF;

  -- Project layer (deepest refs first).
  UPDATE projects SET forked_from_project_id = NULL WHERE cycle_id = target_id;
  DELETE FROM project_memberships   WHERE cycle_id = target_id;
  DELETE FROM project_roles         WHERE project_id IN (SELECT id FROM projects WHERE cycle_id = target_id);
  DELETE FROM project_subscriptions WHERE project_id IN (SELECT id FROM projects WHERE cycle_id = target_id);
  DELETE FROM participant_roles     WHERE project_id IN (SELECT id FROM projects WHERE cycle_id = target_id);
  DELETE FROM project_votes         WHERE cycle_id = target_id;
  DELETE FROM projects              WHERE cycle_id = target_id;
  DELETE FROM solution_proposals    WHERE cycle_id = target_id;

  -- Pod membership / moderator / poderator scope + pod-scoped logs & invites.
  DELETE FROM moderator_assignments WHERE cycle_id = target_id;
  DELETE FROM pod_memberships       WHERE pod_id IN (SELECT id FROM pods WHERE cycle_id = target_id);
  DELETE FROM nudge_dismissals      WHERE pod_id IN (SELECT id FROM pods WHERE cycle_id = target_id);
  DELETE FROM participant_roles     WHERE pod_id IN (SELECT id FROM pods WHERE cycle_id = target_id);
  DELETE FROM leadership_logs       WHERE cycle_id = target_id
                                       OR pod_id IN (SELECT id FROM pods WHERE cycle_id = target_id);
  DELETE FROM invitations           WHERE cycle_id = target_id
                                       OR pod_id IN (SELECT id FROM pods WHERE cycle_id = target_id);
  DELETE FROM pods                  WHERE cycle_id = target_id;

  -- Problem layer.
  DELETE FROM votes                 WHERE cycle_id = target_id;
  DELETE FROM problem_statements    WHERE cycle_id = target_id;

  -- Cycle-scoped engagement, roster, and cycle-only authority scope.
  DELETE FROM pulse_checks          WHERE cycle_id = target_id;
  DELETE FROM learning_logs         WHERE cycle_id = target_id;
  DELETE FROM cycle_agreements      WHERE cycle_id = target_id;
  DELETE FROM nominations           WHERE cycle_id = target_id;
  DELETE FROM cycle_enrollments     WHERE cycle_id = target_id;
  DELETE FROM participant_roles     WHERE cycle_id = target_id;

  -- Preserved: field_surveys (+ answers) = commons research; access_revocations = audit
  -- trail; global/cross-cycle participant_roles (cycle_id/pod_id/project_id all NULL).

  -- Re-seed the config shell to defaults, return the cycle to draft.
  DELETE FROM cycle_config WHERE cycle_id = target_id;
  INSERT INTO cycle_config (cycle_id) VALUES (target_id);
  UPDATE cycles SET status = 'draft' WHERE id = target_id;

  INSERT INTO owner_actions (actor_participant_id, actor_email, entity_type, entity_id, entity_label, action, reason)
  VALUES ((SELECT id FROM participants WHERE auth_user_id = auth.uid()),
          (SELECT email FROM participants WHERE auth_user_id = auth.uid()),
          'cycles', target_id::varchar, target_label, 'reset', why);
END;
$$;
REVOKE ALL ON FUNCTION reset_cycle(integer, varchar) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION reset_cycle(integer, varchar) TO authenticated;

-- DOWN:
-- DROP FUNCTION IF EXISTS reset_cycle(integer, varchar);
-- DROP FUNCTION IF EXISTS reset_pod(integer, varchar);
-- DROP FUNCTION IF EXISTS reset_project(integer, varchar);
