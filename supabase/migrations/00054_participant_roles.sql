-- 00054_participant_roles.sql — onboarding redesign (generated from docs/DB_CHANGES_ONBOARDING.md rev 2)
-- Copy into OLOS's supabase/migrations/ — see handoff-to-olos/README.md

-- Unified temporal roles: replaces role_intents-as-truth (no history),
-- user_roles (staff only), moderator_assignments (poderator only).
-- A role is active while revoked_at IS NULL. Moving upskiller → volunteer →
-- upskiller again = three rows; nothing is ever overwritten.

CREATE TABLE IF NOT EXISTS participant_roles (
  id              serial PRIMARY KEY,
  participant_id  integer NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  role            varchar NOT NULL CHECK (role IN (
                    -- member roles (self-chosen at signup / welcome-back / admin-granted)
                    'upskiller','volunteer','mentor','events',
                    -- operational roles (granted; 'owner' = super admin)
                    'poderator','admin','owner','observer','developer')),
  cycle_id        integer REFERENCES cycles(id),   -- scope where relevant (poderator)
  pod_id          integer REFERENCES pods(id),     -- scope for poderator assignments
  granted_by      integer REFERENCES participants(id),  -- NULL = self-selected at signup
  granted_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,
  revoked_by      integer REFERENCES participants(id),
  note            text
);
CREATE INDEX IF NOT EXISTS idx_proles_active ON participant_roles (participant_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_proles_role   ON participant_roles (role) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_proles_active ON participant_roles
  (participant_id, role, COALESCE(cycle_id,0), COALESCE(pod_id,0)) WHERE revoked_at IS NULL;

-- Backfill: role_intents ('cycle' → 'upskiller'), staff roles, poderator assignments.
INSERT INTO participant_roles (participant_id, role, granted_at)
SELECT p.id, CASE r WHEN 'cycle' THEN 'upskiller' ELSE r END, p.created_at
FROM participants p, unnest(p.role_intents) AS r
ON CONFLICT DO NOTHING;

INSERT INTO participant_roles (participant_id, role, granted_by, granted_at, revoked_at)
SELECT participant_id, role, granted_by, granted_at, revoked_at FROM user_roles
ON CONFLICT DO NOTHING;

INSERT INTO participant_roles (participant_id, role, cycle_id, pod_id, granted_at, revoked_at)
SELECT participant_id, 'poderator', cycle_id, pod_id, assigned_at, removed_at
FROM moderator_assignments
ON CONFLICT DO NOTHING;

-- RLS: members read their own roles; admins read/write all (see 00058 for the
-- is_admin()/is_owner() helpers this depends on — apply 00058's helpers first
-- if enabling RLS in the same deploy).
ALTER TABLE participant_roles ENABLE ROW LEVEL SECURITY;
