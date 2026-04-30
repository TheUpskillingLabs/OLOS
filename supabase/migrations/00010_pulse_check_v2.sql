-- Pulse Check V2
-- Adds nominations table, 7-day enforcement tracking, and refreshes pulse_benefits options.

-- 1. Nominations table
CREATE TABLE nominations (
  id SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  pulse_check_id INT REFERENCES pulse_checks(id) ON DELETE SET NULL,
  cycle_id INT REFERENCES cycles(id),
  nominee_name VARCHAR(255) NOT NULL,
  nominee_email VARCHAR(320),
  nominee_linkedin VARCHAR(500),
  nomination_type VARCHAR(20) NOT NULL CHECK (nomination_type IN ('upskiller', 'mentor', 'advisor')),
  reason TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_nominations_participant ON nominations(participant_id);
CREATE INDEX idx_nominations_cycle ON nominations(cycle_id);
CREATE INDEX idx_nominations_type ON nominations(nomination_type);

ALTER TABLE nominations ENABLE ROW LEVEL SECURITY;

-- SELECT: own, or has participants:read, or moderator of a pod the nominator belongs to
CREATE POLICY "nominations_select" ON nominations FOR SELECT TO authenticated
  USING (
    participant_id = current_participant_id()
    OR has_permission('participants:read')
    OR EXISTS (
      SELECT 1
      FROM pod_memberships pm
      JOIN moderator_assignments ma ON ma.pod_id = pm.pod_id
      JOIN participants mp ON mp.id = ma.participant_id
      WHERE pm.participant_id = nominations.participant_id
        AND mp.auth_user_id = auth.uid()
        AND ma.removed_at IS NULL
        AND pm.inactive_at IS NULL
    )
  );

-- INSERT: only as self
CREATE POLICY "nominations_insert_own" ON nominations FOR INSERT TO authenticated
  WITH CHECK (participant_id = current_participant_id());

-- 2. 7-day enforcement tracking on participants
ALTER TABLE participants ADD COLUMN last_pulse_completed_at TIMESTAMP;

UPDATE participants p
SET last_pulse_completed_at = (
  SELECT MAX(pc.completed_at)
  FROM pulse_checks pc
  WHERE pc.participant_id = p.id AND pc.completed_at IS NOT NULL
);

-- 3. Refresh pulse_benefits option list. Existing values are deactivated (not deleted)
-- so historical pulse_checks.survey_responses references remain valid.
UPDATE option_lists SET active = FALSE WHERE list_name = 'pulse_benefits';

INSERT INTO option_lists (list_name, value, display_order, active) VALUES
  ('pulse_benefits', 'Working on a real project I can show to employers', 1, TRUE),
  ('pulse_benefits', 'Learning alongside peers by doing, not just reading', 2, TRUE),
  ('pulse_benefits', 'Improving how I work using new tools', 3, TRUE),
  ('pulse_benefits', 'Contributing to something that matters beyond myself', 4, TRUE),
  ('pulse_benefits', 'Meeting collaborators and mentors', 5, TRUE),
  ('pulse_benefits', 'Building confidence navigating new technology', 6, TRUE),
  ('pulse_benefits', 'Attending a workshop or office hours session', 7, TRUE);
