-- 00104_announcement_schedule_expiry.sql
-- Scheduled go-live + auto-expiry for org announcements (00070).
--
-- Admins asked for three things: archive a post, schedule it to go live at a
-- future date/time, and have it auto-archive at an expiration date (defaulting
-- to two weeks from creation, but editable).
--
-- Go-live reuses published_at rather than adding a column. It already means
-- "when this post appeared in the feed"; a 'published' row whose published_at
-- is still in the future is a SCHEDULED post. The feed (and the member read
-- policy below) only shows published rows whose published_at <= now().
--
-- expires_at is new. NULL = never expires. The column is added WITHOUT a
-- default first, so legacy rows stay NULL — otherwise every existing post
-- would be stamped now()+14d and silently vanish two weeks after this ships.
-- The 14-day default is set afterwards and applies only to new inserts (the
-- app sends an explicit value; the default covers any other writer).
--
-- Visibility is enforced at read time (exact, no cron lag): members see
-- published rows with published_at <= now() AND (expires_at IS NULL OR
-- expires_at > now()). The hourly /api/cron/announcement-expiry sweep then
-- flips expired rows to status='archived' so the admin surface and the
-- owner registry's archive (lib/owner/registry.ts) agree with what members see.
--
-- Idempotent + re-runnable.
--
-- DOWN:
--   DROP POLICY IF EXISTS announcements_select ON announcements;
--   CREATE POLICY announcements_select ON announcements FOR SELECT TO authenticated
--     USING (status = 'published' OR is_admin_or_owner());
--   DROP INDEX IF EXISTS idx_announcements_expiry;
--   ALTER TABLE announcements DROP COLUMN IF EXISTS expires_at;

ALTER TABLE announcements ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE announcements ALTER COLUMN expires_at SET DEFAULT (now() + interval '14 days');

-- The expiry sweep: published rows that carry an expiration.
CREATE INDEX IF NOT EXISTS idx_announcements_expiry
  ON announcements (expires_at)
  WHERE status = 'published' AND expires_at IS NOT NULL;

-- Members read only rows that are live right now: published, past their
-- go-live, not yet expired. Admins/owners still read every status (drafts,
-- scheduled, expired, archived) for the admin surface.
DROP POLICY IF EXISTS announcements_select ON announcements;
CREATE POLICY announcements_select ON announcements FOR SELECT TO authenticated
  USING (
    (
      status = 'published'
      AND (published_at IS NULL OR published_at <= now())
      AND (expires_at IS NULL OR expires_at > now())
    )
    OR is_admin_or_owner()
  );
