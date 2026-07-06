-- Slack integration (ISSUE #189) — reminders in Slack, an in-Slack Learning
-- Log (slash command), and polled membership + intro-post verification.
--
-- Adds the Slack identity mapping and onboarding-verification state onto
-- participants. The API-stable Slack user id (Uxxxx) is resolved once from the
-- participant's UNIQUE email via users.lookupByEmail and cached in
-- slack_user_id; a slash command coming in from Slack is mapped back to a
-- participant by that id. The two _at stamps record when the daily
-- verification cron confirmed workspace/#intros membership (slack_joined_at)
-- and found an authored intro post in #intros (slack_intro_at); slack_checked_at
-- records the last run so the surfaces can show freshness.
--
-- slack_username already exists (00001) but is a free-text handle typed at
-- registration, not the API id — keep both; this migration never touches it.
--
-- Additive only. The participants SELECT policies are row-level (no column
-- grants), so they already cover these columns; the crons write via the
-- service-role client, so no new write policy is needed.

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS slack_user_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS slack_joined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS slack_intro_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS slack_checked_at TIMESTAMPTZ;

-- Mapping an inbound Slack user_id → participant is the hot path on every
-- slash command / modal submission; index it. Partial (only mapped rows).
CREATE INDEX IF NOT EXISTS idx_participants_slack_user_id
  ON participants (slack_user_id)
  WHERE slack_user_id IS NOT NULL;

-- DOWN:
-- DROP INDEX IF EXISTS idx_participants_slack_user_id;
-- ALTER TABLE participants
--   DROP COLUMN IF EXISTS slack_user_id,
--   DROP COLUMN IF EXISTS slack_joined_at,
--   DROP COLUMN IF EXISTS slack_intro_at,
--   DROP COLUMN IF EXISTS slack_checked_at;
