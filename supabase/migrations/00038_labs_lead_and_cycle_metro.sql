-- Local labs leads: a metro-scoped role that manages the pod/project lifecycle
-- for its own region. Two schema needs:
--
-- 1. cycles.metro_slug — associates a cycle with a metro so a labs lead can be
--    scoped to "their" cycles. Nullable; NULL = unassigned (only global admins
--    manage it). Mirrors participants.metro_slug (see lib/metros.ts).
--
-- 2. user_roles.role CHECK — currently only allows owner/admin/observer, which
--    silently rejects the 'developer' role the invitation flow already tries to
--    insert, and would reject the new 'labs_lead' role. Widen the allow-list to
--    the full set of stored elevated roles (moderator/participant are derived,
--    never stored here). participant_permissions remains the source of truth for
--    `can()`; user_roles is the audit/identity row.

ALTER TABLE cycles
  ADD COLUMN IF NOT EXISTS metro_slug VARCHAR(50);

ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('owner', 'admin', 'observer', 'developer', 'labs_lead'));
