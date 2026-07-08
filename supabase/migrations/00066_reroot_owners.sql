-- 00066_reroot_owners.sql
-- Establish a single rooted ownership tree: hello@brendanwhitaker.com is the
-- primary HQ owner (the apex, granted_by NULL); every other owner becomes a
-- co-owner granted BY the root (provenance); the maya.johnson test fixture is
-- demoted owner → admin (kept usable as a test admin, no longer a spurious
-- co-equal root). Replaces the old "any OWNER_EMAILS address self-promotes"
-- bootstrap, which produced several provenance-less owners.
--
-- Operates on participant_roles (the authority source of truth after 00064/65)
-- and mirrors into user_roles for consistency during the transition. Runs with
-- the 00065 sync triggers live (idempotent; migration context is auth.uid()
-- NULL so the owner-guard trigger passes).
--
-- Idempotent + re-runnable.
--
-- DOWN: (no automatic restore of prior granted_by — capture a snapshot before
-- running in an environment where the prior owner graph must be recoverable;
-- see docs/AUTH_UNIFICATION_RUNBOOK.md.)

DO $$
DECLARE
  root_id  integer;
  maya_id  integer;
BEGIN
  SELECT id INTO root_id FROM participants WHERE email = 'hello@brendanwhitaker.com';
  IF root_id IS NULL THEN
    -- Fresh DB (e.g. local `supabase db reset` before seeds): nothing to
    -- re-root. Ownership is bootstrapped deliberately, not by this migration.
    RAISE NOTICE '00066: hello@brendanwhitaker.com not present — skipping re-root (fresh DB)';
    RETURN;
  END IF;
  SELECT id INTO maya_id FROM participants WHERE email = 'maya.johnson@example.com';

  -- Root: exactly one active owner row, granted_by NULL (the apex).
  IF EXISTS (SELECT 1 FROM participant_roles WHERE participant_id = root_id AND role = 'owner' AND revoked_at IS NULL) THEN
    UPDATE participant_roles SET granted_by = NULL, note = 'HQ primary owner (re-root)'
    WHERE participant_id = root_id AND role = 'owner' AND revoked_at IS NULL;
  ELSE
    INSERT INTO participant_roles (participant_id, role, granted_by, note)
    VALUES (root_id, 'owner', NULL, 'HQ primary owner (re-root)');
  END IF;

  -- Every other active owner → co-owner granted by the root (excluding maya).
  UPDATE participant_roles
    SET granted_by = root_id, note = 'co-owner (re-rooted under HQ owner)'
  WHERE role = 'owner' AND revoked_at IS NULL
    AND participant_id <> root_id
    AND (maya_id IS NULL OR participant_id <> maya_id);

  -- Demote the maya.johnson fixture: revoke owner, ensure an active admin role
  -- so the test persona stays usable as a non-owner admin.
  IF maya_id IS NOT NULL THEN
    UPDATE participant_roles SET revoked_at = now(), revoked_by = root_id
    WHERE participant_id = maya_id AND role = 'owner' AND revoked_at IS NULL;

    INSERT INTO participant_roles (participant_id, role, granted_by, note)
    SELECT maya_id, 'admin', root_id, 're-root: demoted owner → admin (test fixture)'
    WHERE NOT EXISTS (
      SELECT 1 FROM participant_roles WHERE participant_id = maya_id
        AND role IN ('admin','owner') AND revoked_at IS NULL);
  END IF;

  -- Mirror into user_roles for consistency during the transition window.
  UPDATE user_roles SET granted_by = NULL
    WHERE participant_id = root_id AND role = 'owner' AND revoked_at IS NULL;
  UPDATE user_roles SET granted_by = root_id
    WHERE role = 'owner' AND revoked_at IS NULL AND participant_id <> root_id
      AND (maya_id IS NULL OR participant_id <> maya_id);
  IF maya_id IS NOT NULL THEN
    UPDATE user_roles SET revoked_at = now()
      WHERE participant_id = maya_id AND role = 'owner' AND revoked_at IS NULL;
    INSERT INTO user_roles (participant_id, role, granted_by)
    SELECT maya_id, 'admin', root_id
    WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE participant_id = maya_id AND role = 'admin' AND revoked_at IS NULL);
  END IF;

  RAISE NOTICE '00066: re-rooted ownership under participant % (hello@brendanwhitaker.com)', root_id;
END $$;
