-- Granular Permissions Model + Invitations
-- Replaces role-only access with individual permission toggles.
-- Roles become presets that batch-assign groups of permissions.

-- 1. participant_permissions table
CREATE TABLE participant_permissions (
  id SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  permission VARCHAR(50) NOT NULL,
  granted_by INT REFERENCES participants(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP,
  UNIQUE(participant_id, permission)
);

CREATE INDEX idx_participant_permissions_participant ON participant_permissions(participant_id);
CREATE INDEX idx_participant_permissions_permission ON participant_permissions(permission);

-- RLS for participant_permissions
ALTER TABLE participant_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permissions_select_own" ON participant_permissions FOR SELECT TO authenticated
  USING (participant_id = current_participant_id() OR is_admin_or_owner());
CREATE POLICY "permissions_insert" ON participant_permissions FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_owner());
CREATE POLICY "permissions_update" ON participant_permissions FOR UPDATE TO authenticated
  USING (is_admin_or_owner());

-- 2. Migrate existing user_roles → participant_permissions
INSERT INTO participant_permissions (participant_id, permission, granted_by, granted_at)
SELECT ur.participant_id, p.permission, ur.granted_by, ur.granted_at
FROM user_roles ur
CROSS JOIN LATERAL (
  SELECT unnest(CASE ur.role
    WHEN 'owner' THEN ARRAY[
      'cycles:read','cycles:write','participants:read','participants:write',
      'pods:read','pods:write','pulse_checks:read',
      'roles:read','roles:write','invitations:read','invitations:write','testing:use',
      'moderate:assigned_pods'
    ]
    WHEN 'admin' THEN ARRAY[
      'cycles:read','cycles:write','participants:read','participants:write',
      'pods:read','pods:write','pulse_checks:read',
      'roles:read','roles:write','invitations:read','invitations:write'
    ]
    WHEN 'developer' THEN ARRAY[
      'cycles:read','cycles:write','participants:read','participants:write',
      'pods:read','pods:write','pulse_checks:read',
      'roles:read','roles:write','invitations:read','invitations:write','testing:use'
    ]
    WHEN 'observer' THEN ARRAY[
      'cycles:read','participants:read','pods:read','pulse_checks:read'
    ]
  END) AS permission
) p
WHERE ur.revoked_at IS NULL
ON CONFLICT (participant_id, permission) DO NOTHING;

-- 3. Migrate moderator_assignments → permissions
INSERT INTO participant_permissions (participant_id, permission, granted_at)
SELECT DISTINCT ma.participant_id, p.permission, ma.assigned_at
FROM moderator_assignments ma
CROSS JOIN LATERAL (
  SELECT unnest(ARRAY['moderate:assigned_pods', 'pods:read', 'pulse_checks:read']) AS permission
) p
WHERE ma.removed_at IS NULL
ON CONFLICT (participant_id, permission) DO NOTHING;

-- 4. RLS helper: check if current user has a specific permission
CREATE OR REPLACE FUNCTION has_permission(perm TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM participant_permissions pp
    JOIN participants p ON p.id = pp.participant_id
    WHERE p.auth_user_id = auth.uid()
      AND pp.permission = perm
      AND pp.revoked_at IS NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 5. Redefine is_admin_or_owner() to use permissions (keeps all existing RLS policies working)
CREATE OR REPLACE FUNCTION is_admin_or_owner()
RETURNS BOOLEAN AS $$
  SELECT has_permission('cycles:write');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 6. Invitations table
CREATE TABLE invitations (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  permissions TEXT[] DEFAULT ARRAY[]::TEXT[],
  role_preset VARCHAR(50),
  cycle_id INT REFERENCES cycles(id),
  pod_id INT REFERENCES pods(id),
  invited_by INT NOT NULL REFERENCES participants(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days')
);

CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_token ON invitations(token);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invitations_select" ON invitations FOR SELECT TO authenticated
  USING (has_permission('invitations:read'));
CREATE POLICY "invitations_insert" ON invitations FOR INSERT TO authenticated
  WITH CHECK (has_permission('invitations:write'));
CREATE POLICY "invitations_update" ON invitations FOR UPDATE TO authenticated
  USING (has_permission('invitations:write'));
