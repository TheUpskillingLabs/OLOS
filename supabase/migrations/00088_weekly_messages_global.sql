-- 00088_weekly_messages_global.sql
--
-- The weekly "What's next" message is PROGRAM-GLOBAL, not per-cycle (owner
-- decision during PR #264 review): one admin-authored message per wk0→wk12
-- marker, shared by every open cycle. 00087 shipped the table cycle-scoped
-- (cycle_weekly_messages); this replaces it with a global weekly_messages
-- table. The feature is unreleased and the cycle-scoped table carries no real
-- data, so a straight drop is safe — no backfill needed.
--
-- RLS matches 00087's posture: all-authenticated read (the dashboard and the
-- learning-log POST surface the current week's message to members),
-- admin-only writes.
--
-- DOWN:
--   DROP TABLE IF EXISTS weekly_messages;
--   -- recreate cycle_weekly_messages per 00087's §3 if reverting.

DROP TABLE IF EXISTS cycle_weekly_messages;

CREATE TABLE IF NOT EXISTS weekly_messages (
  id         SERIAL PRIMARY KEY,
  week       SMALLINT NOT NULL UNIQUE CHECK (week BETWEEN 0 AND 12),
  message    TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE weekly_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS weekly_messages_select ON weekly_messages;
CREATE POLICY weekly_messages_select ON weekly_messages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS weekly_messages_write ON weekly_messages;
CREATE POLICY weekly_messages_write ON weekly_messages
  FOR ALL TO authenticated USING (is_admin_or_owner());
