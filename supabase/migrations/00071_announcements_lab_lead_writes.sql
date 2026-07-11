-- 00071_announcements_lab_lead_writes.sql
-- Let lab leads author announcements scoped to their own lab (docs/LOCAL_LABS.md).
-- Today only admins/owners can write announcements (00070). This adds an
-- is_lab_lead(lab_id) predicate and relaxes the write policy so a lab lead may
-- write rows whose lab_id is a lab they actively lead — but NEVER an org-wide
-- row (lab_id NULL stays admin-only) nor a row for a lab they don't lead
-- (WITH CHECK re-tests the resulting lab_id, blocking a move to another lab).
--
-- is_lab_lead mirrors is_admin() (00058/00064): SECURITY DEFINER, reads the
-- unified authority table participant_roles (role='lab_lead', not revoked),
-- which is what resolveUserRoles() reads for labLeadLabIds. The app authors via
-- service-role routes gated by requireLabAccess() (lib/auth/lab.ts); this policy
-- is the defense-in-depth boundary.
--
-- Idempotent + re-runnable.
--
-- DOWN:
--   DROP POLICY IF EXISTS announcements_write ON announcements;
--   CREATE POLICY announcements_write ON announcements FOR ALL TO authenticated
--     USING (is_admin_or_owner()) WITH CHECK (is_admin_or_owner());
--   DROP FUNCTION IF EXISTS is_lab_lead(INT);

CREATE OR REPLACE FUNCTION is_lab_lead(target_lab_id INT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM participant_roles pr
    JOIN participants p ON p.id = pr.participant_id
    WHERE p.auth_user_id = auth.uid()
      AND pr.role = 'lab_lead'
      AND pr.lab_id = target_lab_id
      AND pr.revoked_at IS NULL
  );
$$;

-- Read policy is unchanged (00070): published rows for everyone, all statuses
-- for admins. Only the write policy widens to lab leads for their own lab.
DROP POLICY IF EXISTS announcements_write ON announcements;
CREATE POLICY announcements_write ON announcements FOR ALL TO authenticated
  USING (is_admin_or_owner() OR (lab_id IS NOT NULL AND is_lab_lead(lab_id)))
  WITH CHECK (is_admin_or_owner() OR (lab_id IS NOT NULL AND is_lab_lead(lab_id)));
