-- Add 'developer' to user_roles CHECK constraint
ALTER TABLE user_roles DROP CONSTRAINT user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('owner', 'admin', 'observer', 'developer'));

-- Update RLS helper to include developer
CREATE OR REPLACE FUNCTION is_admin_or_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN participants p ON p.id = ur.participant_id
    WHERE p.auth_user_id = auth.uid()
      AND ur.role IN ('owner', 'admin', 'developer')
      AND ur.revoked_at IS NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
