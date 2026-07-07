-- 00068_service_role_admin_paths.sql — onboarding admin backend (stage 2).
--
-- 00058's owner-gated functions check is_owner() via auth.uid(), which is NULL
-- when the caller is server code using the service role (the onboarding admin
-- edge function). The edge function does its own human-role check (the signed-in
-- caller must hold an active admin/owner participant_role) and then acts with
-- the service role — so these paths must accept service_role as trusted.
-- Service role already bypasses RLS everywhere; this brings the trigger and the
-- two SECURITY DEFINER functions in line with that model.
--
-- Idempotent (CREATE OR REPLACE / DROP+CREATE TRIGGER).
--
-- DOWN: re-apply the 00058 definitions.

CREATE OR REPLACE FUNCTION is_service_role() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(auth.role(), '') = 'service_role';
$$;

-- 1. Email guard: members and admins still can't change email; owner OR
--    trusted server code can.
CREATE OR REPLACE FUNCTION guard_email_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email AND NOT (is_owner() OR is_service_role()) THEN
    RAISE EXCEPTION 'email changes are super-admin only';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_email ON participants;
CREATE TRIGGER trg_guard_email BEFORE UPDATE OF email ON participants
  FOR EACH ROW EXECUTE FUNCTION guard_email_change();

-- 2. change_participant_email: same acceptance of service_role.
CREATE OR REPLACE FUNCTION change_participant_email(target_id integer, new_email varchar)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_auth uuid;
BEGIN
  IF NOT (is_owner() OR is_service_role()) THEN
    RAISE EXCEPTION 'change_participant_email: owner (super admin) only';
  END IF;
  SELECT auth_user_id INTO target_auth FROM participants WHERE id = target_id;
  UPDATE participants SET email = new_email WHERE id = target_id;
  IF target_auth IS NOT NULL THEN UPDATE auth.users SET email = new_email WHERE id = target_auth; END IF;
END;
$$;

-- 3. delete_participant: same. The erased_by lookup degrades to NULL for
--    service-role callers (the edge function logs the acting admin itself).
CREATE OR REPLACE FUNCTION delete_participant(target_id integer, why varchar DEFAULT 'erasure_request')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_auth uuid;
BEGIN
  IF NOT (is_owner() OR is_service_role()) THEN
    RAISE EXCEPTION 'delete_participant: owner (super admin) only';
  END IF;
  SELECT auth_user_id INTO target_auth FROM participants WHERE id = target_id;

  -- Tables added by dev migrations 00033–00053 (audited 2026-07-06):
  DELETE FROM learning_logs           WHERE participant_id = target_id;
  DELETE FROM profile_updates         WHERE participant_id = target_id;
  DELETE FROM event_rsvps             WHERE participant_id = target_id;
  UPDATE survey_responses SET participant_id = NULL, submitter_name = NULL,
    submitter_email = NULL, submitter_phone = NULL, contactable = false
    WHERE participant_id = target_id;
  DELETE FROM testers WHERE email = (SELECT email FROM participants WHERE id = target_id);
  UPDATE testers SET granted_by = NULL WHERE granted_by = target_id;
  -- saved_items cascades via its FK. The pre-existing tables:
  DELETE FROM nudge_dismissals        WHERE moderator_participant_id = target_id;
  DELETE FROM moderator_ui_state      WHERE participant_id = target_id;
  DELETE FROM feedback_attachments    WHERE feedback_id IN (SELECT id FROM feedback WHERE participant_id = target_id);
  DELETE FROM feedback                WHERE participant_id = target_id;
  DELETE FROM nominations             WHERE participant_id = target_id;
  DELETE FROM pulse_checks            WHERE participant_id = target_id;
  DELETE FROM project_memberships     WHERE participant_id = target_id;
  DELETE FROM project_votes           WHERE voter_id = target_id;
  DELETE FROM votes                   WHERE voter_id = target_id;
  DELETE FROM pod_memberships         WHERE participant_id = target_id;
  DELETE FROM moderator_assignments   WHERE participant_id = target_id;
  DELETE FROM cycle_enrollments       WHERE participant_id = target_id;
  DELETE FROM cycle_agreements        WHERE participant_id = target_id;
  DELETE FROM access_revocations      WHERE participant_id = target_id;
  DELETE FROM participant_permissions WHERE participant_id = target_id;
  DELETE FROM participant_options     WHERE participant_id = target_id;
  DELETE FROM user_roles              WHERE participant_id = target_id;
  UPDATE problem_statements  SET participant_id = NULL WHERE participant_id = target_id;
  UPDATE solution_proposals  SET participant_id = NULL WHERE participant_id = target_id;

  DELETE FROM participants WHERE id = target_id;
  IF target_auth IS NOT NULL THEN DELETE FROM auth.users WHERE id = target_auth; END IF;

  INSERT INTO participant_erasures (erased_by, reason)
  VALUES ((SELECT id FROM participants WHERE auth_user_id = auth.uid()), why);
END;
$$;
