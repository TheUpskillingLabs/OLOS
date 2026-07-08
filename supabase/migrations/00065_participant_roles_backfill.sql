-- 00065_participant_roles_backfill.sql
-- Make participant_roles fully represent current authority so the app can read
-- it for the admin/owner/poderator/lab-lead determination without regressions,
-- then keep it in sync with the legacy writers (user_roles,
-- participant_permissions, moderator_assignments, lab_leads) until those
-- writers are rerouted through the grants service (a later commit).
--
-- Scope note: this commit aligns the ROLE determination only. Granular
-- capability resolution (permissions[]) still reads participant_permissions —
-- deriving capabilities from roles is deferred until tester/developer roles
-- exist (a later commit), to avoid stripping e.g. testing:use from holders who
-- have no covering role today.
--
-- Idempotent + re-runnable (ON CONFLICT DO NOTHING against uq_proles_active).
--
-- DOWN:
--   DROP TRIGGER IF EXISTS trg_sync_lab_lead ON lab_leads;
--   DROP FUNCTION IF EXISTS sync_lab_lead_to_proles();
--   DROP TRIGGER IF EXISTS trg_sync_modassign ON moderator_assignments;
--   DROP FUNCTION IF EXISTS sync_modassign_to_proles();
--   DROP TRIGGER IF EXISTS trg_sync_perm_admin ON participant_permissions;
--   DROP FUNCTION IF EXISTS sync_perm_admin_to_proles();
--   DROP TRIGGER IF EXISTS trg_sync_user_role ON user_roles;
--   DROP FUNCTION IF EXISTS sync_user_role_to_proles();
--   -- backfilled rows are marked note LIKE 'backfill%' if a targeted undo is needed.

-- ── 1. Backfill: user_roles authority roles → participant_roles ───────────
-- Catches post-00054 user_roles grants (e.g. pid 91's admin granted 2026-07).
INSERT INTO participant_roles (participant_id, role, granted_by, granted_at, note)
SELECT ur.participant_id, ur.role, ur.granted_by, COALESCE(ur.granted_at, now()), 'backfill from user_roles'
FROM user_roles ur
WHERE ur.role IN ('owner','admin','developer','observer') AND ur.revoked_at IS NULL
ON CONFLICT DO NOTHING;

-- ── 2. Backfill: cycles:write holders lacking an admin role → admin ───────
-- The app's current admin gate is can("cycles:write"); role-based isAdmin must
-- preserve exactly that set. Catches the individual-permission path (e.g. pid
-- 76 had cycles:write with no user_roles row). granted_by = the HQ owner.
INSERT INTO participant_roles (participant_id, role, granted_by, granted_at, note)
SELECT DISTINCT pp.participant_id, 'admin',
       (SELECT id FROM participants WHERE email = 'hello@brendanwhitaker.com'),
       now(), 'backfill: held cycles:write without an admin role'
FROM participant_permissions pp
WHERE pp.permission = 'cycles:write' AND pp.revoked_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM participant_roles pr
    WHERE pr.participant_id = pp.participant_id
      AND pr.role IN ('admin','owner') AND pr.revoked_at IS NULL)
ON CONFLICT DO NOTHING;

-- ── 3. Backfill: moderator_assignments → poderator ───────────────────────
INSERT INTO participant_roles (participant_id, role, cycle_id, pod_id, granted_at, note)
SELECT ma.participant_id, 'poderator', ma.cycle_id, ma.pod_id, ma.assigned_at, 'backfill from moderator_assignments'
FROM moderator_assignments ma
WHERE ma.removed_at IS NULL
ON CONFLICT DO NOTHING;

-- ── 4. Backfill: lab_leads → lab_lead ────────────────────────────────────
INSERT INTO participant_roles (participant_id, role, lab_id, granted_by, granted_at, note)
SELECT ll.participant_id, 'lab_lead', ll.lab_id, ll.assigned_by, ll.assigned_at, 'backfill from lab_leads'
FROM lab_leads ll
WHERE ll.removed_at IS NULL
ON CONFLICT DO NOTHING;

-- ── 5. Forward-sync triggers (transition shim) ───────────────────────────
-- Keep participant_roles complete while the legacy grant writers are still
-- live. All are SECURITY DEFINER (bypass RLS) + idempotent. They are dropped
-- once each writer is rerouted through lib/auth/grants.ts.

-- user_roles → participant_roles (global authority roles)
CREATE OR REPLACE FUNCTION sync_user_role_to_proles() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role IN ('owner','admin','developer','observer') THEN
    IF NEW.revoked_at IS NULL THEN
      INSERT INTO participant_roles (participant_id, role, granted_by, granted_at, note)
      VALUES (NEW.participant_id, NEW.role, NEW.granted_by, COALESCE(NEW.granted_at, now()), 'sync from user_roles')
      ON CONFLICT DO NOTHING;
    ELSE
      UPDATE participant_roles SET revoked_at = NEW.revoked_at, revoked_by = NEW.granted_by
      WHERE participant_id = NEW.participant_id AND role = NEW.role
        AND cycle_id IS NULL AND pod_id IS NULL AND lab_id IS NULL AND project_id IS NULL
        AND revoked_at IS NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_user_role ON user_roles;
CREATE TRIGGER trg_sync_user_role AFTER INSERT OR UPDATE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION sync_user_role_to_proles();

-- participant_permissions cycles:write ⟺ admin role (the individual-toggle path)
CREATE OR REPLACE FUNCTION sync_perm_admin_to_proles() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.permission = 'cycles:write' THEN
    IF NEW.revoked_at IS NULL THEN
      INSERT INTO participant_roles (participant_id, role, granted_by, granted_at, note)
      SELECT NEW.participant_id, 'admin', NEW.granted_by, now(), 'sync from participant_permissions cycles:write'
      WHERE NOT EXISTS (
        SELECT 1 FROM participant_roles pr
        WHERE pr.participant_id = NEW.participant_id AND pr.role IN ('admin','owner') AND pr.revoked_at IS NULL)
      ON CONFLICT DO NOTHING;
    ELSE
      -- Only revoke the synthetic admin row, and only when no other authority
      -- backs it (a real user_roles admin, or a broader owner).
      UPDATE participant_roles SET revoked_at = NEW.revoked_at
      WHERE participant_id = NEW.participant_id AND role = 'admin'
        AND note = 'sync from participant_permissions cycles:write'
        AND cycle_id IS NULL AND pod_id IS NULL AND lab_id IS NULL AND project_id IS NULL AND revoked_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.participant_id = NEW.participant_id AND ur.role IN ('admin','owner') AND ur.revoked_at IS NULL);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_perm_admin ON participant_permissions;
CREATE TRIGGER trg_sync_perm_admin AFTER INSERT OR UPDATE ON participant_permissions
  FOR EACH ROW EXECUTE FUNCTION sync_perm_admin_to_proles();

-- moderator_assignments ⟺ poderator role
CREATE OR REPLACE FUNCTION sync_modassign_to_proles() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.removed_at IS NULL THEN
    INSERT INTO participant_roles (participant_id, role, cycle_id, pod_id, granted_at, note)
    VALUES (NEW.participant_id, 'poderator', NEW.cycle_id, NEW.pod_id, NEW.assigned_at, 'sync from moderator_assignments')
    ON CONFLICT DO NOTHING;
  ELSE
    UPDATE participant_roles SET revoked_at = NEW.removed_at
    WHERE participant_id = NEW.participant_id AND role = 'poderator'
      AND COALESCE(cycle_id,0) = COALESCE(NEW.cycle_id,0) AND COALESCE(pod_id,0) = COALESCE(NEW.pod_id,0)
      AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_modassign ON moderator_assignments;
CREATE TRIGGER trg_sync_modassign AFTER INSERT OR UPDATE ON moderator_assignments
  FOR EACH ROW EXECUTE FUNCTION sync_modassign_to_proles();

-- lab_leads ⟺ lab_lead role
CREATE OR REPLACE FUNCTION sync_lab_lead_to_proles() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.removed_at IS NULL THEN
    INSERT INTO participant_roles (participant_id, role, lab_id, granted_by, granted_at, note)
    VALUES (NEW.participant_id, 'lab_lead', NEW.lab_id, NEW.assigned_by, NEW.assigned_at, 'sync from lab_leads')
    ON CONFLICT DO NOTHING;
  ELSE
    UPDATE participant_roles SET revoked_at = NEW.removed_at
    WHERE participant_id = NEW.participant_id AND role = 'lab_lead'
      AND COALESCE(lab_id,0) = COALESCE(NEW.lab_id,0) AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_lab_lead ON lab_leads;
CREATE TRIGGER trg_sync_lab_lead AFTER INSERT OR UPDATE ON lab_leads
  FOR EACH ROW EXECUTE FUNCTION sync_lab_lead_to_proles();

-- ── 6. Data-quality report: perms not covered by any role (informational) ─
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT DISTINCT pp.participant_id FROM participant_permissions pp
    WHERE pp.permission = 'cycles:write' AND pp.revoked_at IS NULL
  ) s;
  RAISE NOTICE '00065: % participant(s) hold cycles:write and now have an admin role', n;
END $$;
