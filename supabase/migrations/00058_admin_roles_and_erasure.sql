-- 00058_admin_roles_and_erasure.sql — onboarding redesign (generated from docs/DB_CHANGES_ONBOARDING.md rev 2)
-- Copy into OLOS's supabase/migrations/ — see handoff-to-olos/README.md

-- Admin capabilities: role helpers for RLS, complete-profile read for admins,
-- and the super-admin (owner) delete that erases everything about a user.

-- Role helpers — SECURITY DEFINER so RLS policies can call them cheaply.
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM participant_roles pr
    JOIN participants p ON p.id = pr.participant_id
    WHERE p.auth_user_id = auth.uid()
      AND pr.role IN ('admin','owner') AND pr.revoked_at IS NULL);
$$;

CREATE OR REPLACE FUNCTION is_owner() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM participant_roles pr
    JOIN participants p ON p.id = pr.participant_id
    WHERE p.auth_user_id = auth.uid()
      AND pr.role = 'owner' AND pr.revoked_at IS NULL);
$$;

-- RLS policies for the new tables + admin complete-profile read.
CREATE POLICY proles_self_read  ON participant_roles FOR SELECT
  USING (participant_id = (SELECT id FROM participants WHERE auth_user_id = auth.uid()));
CREATE POLICY proles_admin_all  ON participant_roles FOR ALL USING (is_admin());
CREATE POLICY agree_self_read   ON agreement_acceptances FOR SELECT
  USING (participant_id = (SELECT id FROM participants WHERE auth_user_id = auth.uid()));
CREATE POLICY agree_admin_read  ON agreement_acceptances FOR SELECT USING (is_admin());
CREATE POLICY email_self_read   ON email_log FOR SELECT
  USING (participant_id = (SELECT id FROM participants WHERE auth_user_id = auth.uid()));
CREATE POLICY email_admin_read  ON email_log FOR SELECT USING (is_admin());
-- Admins see complete profiles (participants already has member-scoped policies
-- from 00020/00021 — this adds the admin lens):
CREATE POLICY participants_admin_read ON participants FOR SELECT USING (is_admin());

-- Email is identity, not profile (owner decision): members can NEVER change it —
-- not through any UPDATE policy — and admins can't either; owner (super admin)
-- only, via the function below. The trigger is the backstop that catches every
-- path, including future policies someone writes too loosely.
CREATE OR REPLACE FUNCTION guard_email_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email AND NOT is_owner() THEN
    RAISE EXCEPTION 'email changes are super-admin only';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_email ON participants;
CREATE TRIGGER trg_guard_email BEFORE UPDATE OF email ON participants
  FOR EACH ROW EXECUTE FUNCTION guard_email_change();

-- The owner-gated change itself: updates the profile AND the identity together,
-- so sign-in follows the new address. Production should also trigger a
-- re-verification email to the new address before/with this change.
CREATE OR REPLACE FUNCTION change_participant_email(target_id integer, new_email varchar)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_auth uuid;
BEGIN
  IF NOT is_owner() THEN RAISE EXCEPTION 'change_participant_email: owner (super admin) only'; END IF;
  SELECT auth_user_id INTO target_auth FROM participants WHERE id = target_id;
  UPDATE participants SET email = new_email WHERE id = target_id;
  IF target_auth IS NOT NULL THEN UPDATE auth.users SET email = new_email WHERE id = target_auth; END IF;
END;
$$;
REVOKE ALL ON FUNCTION change_participant_email(integer, varchar) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION change_participant_email(integer, varchar) TO authenticated; -- gated inside by is_owner()

-- Minimal tombstone: enough to prove an erasure happened, nothing personal.
CREATE TABLE IF NOT EXISTS participant_erasures (
  id            serial PRIMARY KEY,
  erased_by     integer,                     -- owner's participant id (not FK — may outlive them)
  reason        varchar NOT NULL DEFAULT 'erasure_request',
  erased_at     timestamptz NOT NULL DEFAULT now()
);

-- The delete itself — OWNER ONLY, erases everything about the participant.
-- The onboarding-era tables cascade via their FKs; the pre-existing tables
-- (votes, logs, memberships …) have plain FKs, so they're deleted explicitly.
CREATE OR REPLACE FUNCTION delete_participant(target_id integer, why varchar DEFAULT 'erasure_request')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_auth uuid;
BEGIN
  IF NOT is_owner() THEN RAISE EXCEPTION 'delete_participant: owner (super admin) only'; END IF;
  SELECT auth_user_id INTO target_auth FROM participants WHERE id = target_id;

  -- Tables added by dev migrations 00033–00053 (audited 2026-07-06):
  DELETE FROM learning_logs           WHERE participant_id = target_id;
  DELETE FROM profile_updates         WHERE participant_id = target_id;
  DELETE FROM event_rsvps             WHERE participant_id = target_id;  -- rows hold contact PII → delete
  UPDATE survey_responses SET participant_id = NULL, submitter_name = NULL,
    submitter_email = NULL, submitter_phone = NULL, contactable = false
    WHERE participant_id = target_id;  -- observations are commons data → detach + strip ALL contact PII (same policy as problem_statements)
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
  -- participant_roles / agreement_acceptances / email_log cascade via FK.
  -- Authored content that the commons keeps (problem_statements,
  -- solution_proposals) is DETACHED, not deleted — POLICY DECISION, see note.
  UPDATE problem_statements  SET participant_id = NULL WHERE participant_id = target_id;
  UPDATE solution_proposals  SET participant_id = NULL WHERE participant_id = target_id;

  DELETE FROM participants WHERE id = target_id;
  IF target_auth IS NOT NULL THEN DELETE FROM auth.users WHERE id = target_auth; END IF;

  INSERT INTO participant_erasures (erased_by, reason)
  VALUES ((SELECT id FROM participants WHERE auth_user_id = auth.uid()), why);
END;
$$;
REVOKE ALL ON FUNCTION delete_participant(integer, varchar) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_participant(integer, varchar) TO authenticated; -- gated inside by is_owner()
