-- 00079_participant_lifecycle.sql — owner lifecycle management, participant slice
--
-- WHY: owners need to archive / reset / delete a user profile from a governed UI.
--   1. participants.archived_at — the soft-hide flag ("deactivate") the participant
--      table never had. Additive + nullable; NULL = active, as every legacy row is.
--   2. Harden delete_participant (00058) — it currently erases ANY participant,
--      including the rooted primary owner or the caller themselves. Add both guards
--      and write a general owner_actions audit row (00078) alongside the existing
--      participant_erasures tombstone.
--   3. reset_participant — clear a participant's journey/participation history while
--      keeping identity, login, authority, and authored commons content.
--
-- CALLER CONTRACT (critical): delete_participant / reset_participant are is_owner()-
-- gated, and is_owner() reads auth.uid() (00058). They MUST be invoked through the
-- USER-scoped client (the request's cookie session), NOT the service-role client —
-- the service role has no auth.uid(), so is_owner() would return false and the
-- function would RAISE, and the audit actor would resolve NULL. See
-- app/api/owner/participants/[id]/route.ts.
--
-- SCHEMA-CHANGE NOTE: reset_participant enumerates participant-referencing journey
-- tables by hand (the FK spine is ON DELETE NO ACTION). A future migration adding a
-- new such table must decide whether reset should clear it and update this function —
-- audit the FK graph on any change (same standing obligation as delete_participant).

ALTER TABLE participants ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- ── Harden the owner erasure (00058) with apex-owner + self guards + audit ──
CREATE OR REPLACE FUNCTION delete_participant(target_id integer, why varchar DEFAULT 'erasure_request')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_auth  uuid;
  target_label varchar;
BEGIN
  IF NOT is_owner() THEN RAISE EXCEPTION 'delete_participant: owner (super admin) only'; END IF;

  -- The rooted (apex) owner — participant_roles owner grant with granted_by NULL
  -- (00066) — is never console-deletable. Last line of defense below the UI.
  IF EXISTS (SELECT 1 FROM participant_roles
               WHERE participant_id = target_id
                 AND role = 'owner' AND granted_by IS NULL AND revoked_at IS NULL) THEN
    RAISE EXCEPTION 'delete_participant: the primary owner cannot be deleted';
  END IF;

  -- No self-deletion via the console (avoids an owner erasing their own access).
  IF target_id = (SELECT id FROM participants WHERE auth_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'delete_participant: cannot delete yourself';
  END IF;

  SELECT auth_user_id, email INTO target_auth, target_label FROM participants WHERE id = target_id;

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

  INSERT INTO owner_actions (actor_participant_id, actor_email, entity_type, entity_id, entity_label, action, reason)
  VALUES ((SELECT id FROM participants WHERE auth_user_id = auth.uid()),
          (SELECT email FROM participants WHERE auth_user_id = auth.uid()),
          'participants', target_id::varchar, target_label, 'delete', why);
END;
$$;
REVOKE ALL ON FUNCTION delete_participant(integer, varchar) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_participant(integer, varchar) TO authenticated; -- gated inside by is_owner()

-- ── reset_participant: wipe the journey, keep the person ──
-- Clears participation history (enrollments, memberships, moderator work, votes,
-- pulse checks, logs) and re-seeds the profile to the active default (archived_at
-- NULL). Identity (participants row + auth.users), authority (participant_roles /
-- user_roles / participant_permissions), profile options, and authored commons
-- content (problem_statements / solution_proposals) are DELIBERATELY kept — a reset
-- returns the person to a clean, un-enrolled state without changing who they are or
-- what they can do. Roles that a prior archive revoked are NOT restored (re-grant via
-- the access console); reset does not resurrect revoked authority.
CREATE OR REPLACE FUNCTION reset_participant(target_id integer, why varchar DEFAULT 'owner_reset')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_label varchar;
BEGIN
  IF NOT is_owner() THEN RAISE EXCEPTION 'reset_participant: owner (super admin) only'; END IF;

  IF NOT EXISTS (SELECT 1 FROM participants WHERE id = target_id) THEN
    RAISE EXCEPTION 'reset_participant: no such participant %', target_id;
  END IF;

  IF target_id = (SELECT id FROM participants WHERE auth_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'reset_participant: cannot reset yourself';
  END IF;

  SELECT email INTO target_label FROM participants WHERE id = target_id;

  DELETE FROM leadership_logs        WHERE participant_id = target_id;
  DELETE FROM learning_logs          WHERE participant_id = target_id;
  DELETE FROM pulse_checks           WHERE participant_id = target_id;
  DELETE FROM project_votes          WHERE voter_id = target_id;
  DELETE FROM votes                  WHERE voter_id = target_id;
  DELETE FROM project_memberships    WHERE participant_id = target_id;
  DELETE FROM pod_memberships        WHERE participant_id = target_id;
  DELETE FROM moderator_assignments  WHERE participant_id = target_id;
  DELETE FROM cycle_agreements       WHERE participant_id = target_id;
  DELETE FROM cycle_enrollments      WHERE participant_id = target_id;
  DELETE FROM nudge_dismissals       WHERE moderator_participant_id = target_id;
  DELETE FROM moderator_ui_state     WHERE participant_id = target_id;

  UPDATE participants SET archived_at = NULL WHERE id = target_id AND archived_at IS NOT NULL;

  INSERT INTO owner_actions (actor_participant_id, actor_email, entity_type, entity_id, entity_label, action, reason)
  VALUES ((SELECT id FROM participants WHERE auth_user_id = auth.uid()),
          (SELECT email FROM participants WHERE auth_user_id = auth.uid()),
          'participants', target_id::varchar, target_label, 'reset', why);
END;
$$;
REVOKE ALL ON FUNCTION reset_participant(integer, varchar) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION reset_participant(integer, varchar) TO authenticated; -- gated inside by is_owner()

-- DOWN:
-- DROP FUNCTION IF EXISTS reset_participant(integer, varchar);
-- ALTER TABLE participants DROP COLUMN IF EXISTS archived_at;
-- (delete_participant hardening is not auto-reverted — re-apply 00058's body to roll back.)
