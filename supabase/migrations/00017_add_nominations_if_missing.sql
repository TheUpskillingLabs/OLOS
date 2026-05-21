-- ROADMAP §1.9 ops follow-up — bring dev's schema back in sync with prod.
--
-- Migration 00010_pulse_check_v2.sql created the `nominations` table, but the
-- dev Supabase project (created fresh on 2026-05-16) ended up without it —
-- 00010's option_lists / participants effects landed but the table create did
-- not. Prod is correct; only dev is missing it.
--
-- This migration is idempotent: CREATE TABLE / INDEX / POLICY are all guarded
-- so it's a no-op on prod and a one-shot fix on dev. Tracked via
-- supabase_migrations.schema_migrations so the trackers converge.
--
-- The table definition + RLS policies below are copied verbatim from
-- 00010_pulse_check_v2.sql lines 5-43.

CREATE TABLE IF NOT EXISTS nominations (
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

CREATE INDEX IF NOT EXISTS idx_nominations_participant ON nominations(participant_id);
CREATE INDEX IF NOT EXISTS idx_nominations_cycle       ON nominations(cycle_id);
CREATE INDEX IF NOT EXISTS idx_nominations_type        ON nominations(nomination_type);

ALTER TABLE nominations ENABLE ROW LEVEL SECURITY;

-- DROP+CREATE pattern for idempotency: pg < 17 has no CREATE POLICY IF NOT EXISTS.
DROP POLICY IF EXISTS "nominations_select" ON nominations;
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

DROP POLICY IF EXISTS "nominations_insert_own" ON nominations;
CREATE POLICY "nominations_insert_own" ON nominations FOR INSERT TO authenticated
  WITH CHECK (participant_id = current_participant_id());
