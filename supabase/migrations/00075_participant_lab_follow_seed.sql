-- 00075_participant_lab_follow_seed.sql
-- Auto-follow your local lab. A member with an active lab (participants.metro_id)
-- should follow that lab page by default, so lab content reaches their feed
-- without a manual step. This flag records that the one-time seed has run, so a
-- member who later unfollows their lab stays unfollowed (we never re-seed).
--
-- The seed itself is an idempotent insert into `follows` (page_type='lab',
-- page_id=metro_id) performed by the dashboard on load when the flag is false;
-- this migration only adds the marker column.
--
-- Idempotent + re-runnable.
--
-- DOWN: ALTER TABLE participants DROP COLUMN IF EXISTS lab_follow_seeded;

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS lab_follow_seeded BOOLEAN NOT NULL DEFAULT false;
