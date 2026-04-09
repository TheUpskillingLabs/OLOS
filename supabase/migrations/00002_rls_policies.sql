-- Row Level Security Policies
-- Supabase Auth user ID is accessed via auth.uid()

-- Enable RLS on all tables
ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE option_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderator_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE solution_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_revocations ENABLE ROW LEVEL SECURITY;

-- Helper function: check if current user is admin/owner
CREATE OR REPLACE FUNCTION is_admin_or_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN participants p ON p.id = ur.participant_id
    WHERE p.auth_user_id = auth.uid()
      AND ur.role IN ('owner', 'admin')
      AND ur.revoked_at IS NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get current participant id
CREATE OR REPLACE FUNCTION current_participant_id()
RETURNS INT AS $$
  SELECT id FROM participants WHERE auth_user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- cycles: readable by all authenticated; writable by admin
CREATE POLICY "cycles_select" ON cycles FOR SELECT TO authenticated USING (true);
CREATE POLICY "cycles_insert" ON cycles FOR INSERT TO authenticated WITH CHECK (is_admin_or_owner());
CREATE POLICY "cycles_update" ON cycles FOR UPDATE TO authenticated USING (is_admin_or_owner());

-- cycle_config: readable by all authenticated; writable by admin
CREATE POLICY "cycle_config_select" ON cycle_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "cycle_config_insert" ON cycle_config FOR INSERT TO authenticated WITH CHECK (is_admin_or_owner());
CREATE POLICY "cycle_config_update" ON cycle_config FOR UPDATE TO authenticated USING (is_admin_or_owner());

-- participants: users can read their own; admins can read all
CREATE POLICY "participants_select_own" ON participants FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR is_admin_or_owner());
CREATE POLICY "participants_insert" ON participants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "participants_update_own" ON participants FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() OR is_admin_or_owner());

-- option_lists: readable by everyone (including anon for registration form)
CREATE POLICY "option_lists_select" ON option_lists FOR SELECT USING (true);

-- participant_options: users can manage their own; admins can read all
CREATE POLICY "participant_options_select" ON participant_options FOR SELECT TO authenticated
  USING (participant_id = current_participant_id() OR is_admin_or_owner());
CREATE POLICY "participant_options_insert" ON participant_options FOR INSERT TO authenticated
  WITH CHECK (participant_id = current_participant_id());
CREATE POLICY "participant_options_delete" ON participant_options FOR DELETE TO authenticated
  USING (participant_id = current_participant_id());

-- cycle_enrollments: readable by authenticated; writable by admin
CREATE POLICY "cycle_enrollments_select" ON cycle_enrollments FOR SELECT TO authenticated USING (true);
CREATE POLICY "cycle_enrollments_insert" ON cycle_enrollments FOR INSERT TO authenticated WITH CHECK (is_admin_or_owner());
CREATE POLICY "cycle_enrollments_update" ON cycle_enrollments FOR UPDATE TO authenticated USING (is_admin_or_owner());

-- user_roles: admin only
CREATE POLICY "user_roles_select" ON user_roles FOR SELECT TO authenticated
  USING (participant_id = current_participant_id() OR is_admin_or_owner());
CREATE POLICY "user_roles_insert" ON user_roles FOR INSERT TO authenticated WITH CHECK (is_admin_or_owner());
CREATE POLICY "user_roles_update" ON user_roles FOR UPDATE TO authenticated USING (is_admin_or_owner());

-- problem_statements: readable by enrolled participants; writable by active participants
CREATE POLICY "problem_statements_select" ON problem_statements FOR SELECT TO authenticated USING (true);
CREATE POLICY "problem_statements_insert" ON problem_statements FOR INSERT TO authenticated
  WITH CHECK (participant_id = current_participant_id());

-- votes: readable by authenticated; writable by enrolled participants
CREATE POLICY "votes_select" ON votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "votes_insert" ON votes FOR INSERT TO authenticated
  WITH CHECK (voter_id = current_participant_id());

-- pods: readable by all authenticated
CREATE POLICY "pods_select" ON pods FOR SELECT TO authenticated USING (true);
CREATE POLICY "pods_insert" ON pods FOR INSERT TO authenticated WITH CHECK (is_admin_or_owner());
CREATE POLICY "pods_update" ON pods FOR UPDATE TO authenticated USING (is_admin_or_owner());

-- moderator_assignments: readable by admin and assigned moderator
CREATE POLICY "moderator_assignments_select" ON moderator_assignments FOR SELECT TO authenticated
  USING (participant_id = current_participant_id() OR is_admin_or_owner());
CREATE POLICY "moderator_assignments_insert" ON moderator_assignments FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_owner());
CREATE POLICY "moderator_assignments_update" ON moderator_assignments FOR UPDATE TO authenticated
  USING (is_admin_or_owner());

-- pod_memberships: readable by authenticated; self-registration
CREATE POLICY "pod_memberships_select" ON pod_memberships FOR SELECT TO authenticated USING (true);
CREATE POLICY "pod_memberships_insert" ON pod_memberships FOR INSERT TO authenticated
  WITH CHECK (participant_id = current_participant_id());
CREATE POLICY "pod_memberships_update" ON pod_memberships FOR UPDATE TO authenticated
  USING (participant_id = current_participant_id() OR is_admin_or_owner());

-- solution_proposals: readable by authenticated; writable by active pod members
CREATE POLICY "solution_proposals_select" ON solution_proposals FOR SELECT TO authenticated USING (true);
CREATE POLICY "solution_proposals_insert" ON solution_proposals FOR INSERT TO authenticated
  WITH CHECK (participant_id = current_participant_id());

-- project_votes: readable by authenticated; writable by active pod members
CREATE POLICY "project_votes_select" ON project_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "project_votes_insert" ON project_votes FOR INSERT TO authenticated
  WITH CHECK (voter_id = current_participant_id());

-- projects: readable by authenticated; writable by admin/moderator
CREATE POLICY "projects_select" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "projects_insert" ON projects FOR INSERT TO authenticated WITH CHECK (is_admin_or_owner());
CREATE POLICY "projects_update" ON projects FOR UPDATE TO authenticated USING (is_admin_or_owner());

-- project_memberships: readable by authenticated; self-registration
CREATE POLICY "project_memberships_select" ON project_memberships FOR SELECT TO authenticated USING (true);
CREATE POLICY "project_memberships_insert" ON project_memberships FOR INSERT TO authenticated
  WITH CHECK (participant_id = current_participant_id());
CREATE POLICY "project_memberships_update" ON project_memberships FOR UPDATE TO authenticated
  USING (participant_id = current_participant_id() OR is_admin_or_owner());

-- pulse_checks: users see own; admin sees all
CREATE POLICY "pulse_checks_select" ON pulse_checks FOR SELECT TO authenticated
  USING (participant_id = current_participant_id() OR is_admin_or_owner());
CREATE POLICY "pulse_checks_insert" ON pulse_checks FOR INSERT TO authenticated
  WITH CHECK (participant_id = current_participant_id());
CREATE POLICY "pulse_checks_update" ON pulse_checks FOR UPDATE TO authenticated
  USING (participant_id = current_participant_id());

-- access_revocations: admin only
CREATE POLICY "access_revocations_select" ON access_revocations FOR SELECT TO authenticated
  USING (participant_id = current_participant_id() OR is_admin_or_owner());
CREATE POLICY "access_revocations_insert" ON access_revocations FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_owner());
