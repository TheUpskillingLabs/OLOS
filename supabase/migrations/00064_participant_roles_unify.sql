-- 00064_participant_roles_unify.sql
-- Adopt participant_roles (00054) as the source of truth for the ADMIN/OWNER
-- authority determination, read by both the app (resolveUserRoles) and DB RLS
-- (is_admin/is_owner, 00058). Closes the live split-brain: post-00054 grants
-- landed only in user_roles / participant_permissions and were invisible to
-- RLS and the owner-only delete_participant / change_participant_email
-- functions (verified on dev: pids 76 & 91 were app-admins that RLS did not
-- recognize).
--
-- This migration evolves the SCHEMA + role helpers. 00065 backfills and adds
-- forward-sync triggers; 00066 re-roots ownership under the HQ owner. See the
-- unified-authorization plan / docs.
--
-- Idempotent + re-runnable.
--
-- DOWN:
--   DROP TRIGGER IF EXISTS trg_guard_owner_grant ON participant_roles;
--   DROP FUNCTION IF EXISTS guard_owner_grant();
--   CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
--     LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
--     SELECT EXISTS (SELECT 1 FROM participant_roles pr JOIN participants p ON p.id = pr.participant_id
--       WHERE p.auth_user_id = auth.uid() AND pr.role IN ('admin','owner') AND pr.revoked_at IS NULL); $$;
--   DROP INDEX IF EXISTS uq_proles_active;
--   CREATE UNIQUE INDEX uq_proles_active ON participant_roles
--     (participant_id, role, COALESCE(cycle_id,0), COALESCE(pod_id,0)) WHERE revoked_at IS NULL;
--   ALTER TABLE participant_roles DROP CONSTRAINT participant_roles_role_check;
--   ALTER TABLE participant_roles ADD CONSTRAINT participant_roles_role_check CHECK (role IN
--     ('upskiller','volunteer','mentor','events','poderator','admin','owner','observer','developer'));
--   ALTER TABLE participant_roles DROP COLUMN IF EXISTS project_id;
--   ALTER TABLE participant_roles DROP COLUMN IF EXISTS lab_id;

-- ── 1. Scope columns (lab + project) ─────────────────────────────────────
-- participant_roles already scopes by cycle_id/pod_id (00054). Labs (00062)
-- and the project IC ladder (00060) postdate it; add their scope anchors so
-- lab_lead / dri / contributor grants have a home.
ALTER TABLE participant_roles ADD COLUMN IF NOT EXISTS lab_id integer REFERENCES metros(id);
ALTER TABLE participant_roles ADD COLUMN IF NOT EXISTS project_id integer REFERENCES projects(id);

-- ── 2. Widen the role vocabulary ─────────────────────────────────────────
-- 00054's list + the roles that postdate it. Keeps stored 'poderator'
-- (resolveUserRoles maps it to the app label "moderator" — no data rewrite).
ALTER TABLE participant_roles DROP CONSTRAINT IF EXISTS participant_roles_role_check;
ALTER TABLE participant_roles ADD CONSTRAINT participant_roles_role_check CHECK (role IN (
  'upskiller','volunteer','mentor','events',
  'poderator','admin','owner','observer','developer',
  'lab_lead','co_lead','member','dri','contributor','staff','tester'));

-- ── 3. Rebuild the active-unique index over all scopes ───────────────────
-- Old key ignored lab_id/project_id; a lab_lead in two labs (or a contributor
-- on two projects) must be two distinct active rows.
DROP INDEX IF EXISTS uq_proles_active;
CREATE UNIQUE INDEX IF NOT EXISTS uq_proles_active ON participant_roles
  (participant_id, role, COALESCE(cycle_id,0), COALESCE(pod_id,0), COALESCE(lab_id,0), COALESCE(project_id,0))
  WHERE revoked_at IS NULL;

-- ── 4. Owner-guard trigger (backstop for attenuation) ────────────────────
-- proles_admin_all (00058) lets any admin write participant_roles via RLS —
-- including an owner row (self-promotion). Mirror the guard_email_change
-- pattern: an authenticated non-owner cannot create/keep an active owner row.
-- Service-role / migration writes (auth.uid() IS NULL) are trusted and pass,
-- so the backfill + re-root migrations and the vetted app grant path still
-- work; only direct authenticated RLS writes are gated.
CREATE OR REPLACE FUNCTION guard_owner_grant() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'owner' AND NEW.revoked_at IS NULL
     AND auth.uid() IS NOT NULL AND NOT is_owner() THEN
    RAISE EXCEPTION 'owner grants are owner-only';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_owner_grant ON participant_roles;
CREATE TRIGGER trg_guard_owner_grant BEFORE INSERT OR UPDATE ON participant_roles
  FOR EACH ROW EXECUTE FUNCTION guard_owner_grant();

-- ── 5. Align is_admin() with the app's admin set (owner/admin/developer) ──
-- The app treats a developer as an admin (the developer preset is a superset
-- of admin). Add 'developer' so RLS agrees exactly with the app's role-based
-- isAdmin. is_owner() stays owner-only.
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM participant_roles pr
    JOIN participants p ON p.id = pr.participant_id
    WHERE p.auth_user_id = auth.uid()
      AND pr.role IN ('admin','owner','developer') AND pr.revoked_at IS NULL);
$$;
