-- 00070_announcements.sql
-- Org news & announcements: an admin-authored feed surfaced in the participant
-- dashboard's right rail (the LinkedIn-style "org news" panel). A first-class
-- content table alongside spotlights/events (00033/00051).
--
-- Scope model mirrors cycles/workstreams (00062): lab_id NULL = global/org-wide;
-- lab_id set = scoped to one local lab (metros). A member sees published rows
-- that are global OR match their own lab; admins see and write everything.
-- author_participant_id is nullable so a system/institutional post is possible.
--
-- Lifecycle is a real newsroom workflow: draft → published → archived, plus a
-- pinned flag that floats a row to the top of the feed. Members only ever read
-- 'published' rows (RLS); dashboard + admin reads run through the service client
-- (RLS is the defense-in-depth boundary + the members-see-only-published rule).
--
-- RLS posture follows the content tables: authenticated SELECT of published rows
-- (or anything for admins), admin-only writes via is_admin_or_owner() (00009).
-- updated_at owned by the shared set_updated_at() trigger (00037).
--
-- Idempotent + re-runnable.
--
-- DOWN:
--   DROP TABLE IF EXISTS announcements;

CREATE TABLE IF NOT EXISTS announcements (
  id                    SERIAL PRIMARY KEY,
  title                 VARCHAR(200) NOT NULL,
  body                  TEXT NOT NULL,
  author_participant_id INT REFERENCES participants(id),   -- nullable: system/institutional posts
  lab_id                INT REFERENCES metros(id),         -- NULL = global/org-wide; set = one lab
  status                VARCHAR(20) NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'published', 'archived')),
  pinned                BOOLEAN NOT NULL DEFAULT FALSE,
  published_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The member-feed read: published rows, pinned first, newest first.
CREATE INDEX IF NOT EXISTS idx_announcements_feed
  ON announcements (status, pinned DESC, published_at DESC);
-- Lab-scoped filtering (global rows are the common case, so index only the tail).
CREATE INDEX IF NOT EXISTS idx_announcements_lab
  ON announcements (lab_id) WHERE lab_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_announcements_updated_at ON announcements;
CREATE TRIGGER trg_announcements_updated_at BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Members read only published rows; admins/owners read every status (drafts,
-- archived) for the admin surface. Lab-scoping is applied in the query, not RLS.
DROP POLICY IF EXISTS announcements_select ON announcements;
CREATE POLICY announcements_select ON announcements FOR SELECT TO authenticated
  USING (status = 'published' OR is_admin_or_owner());

-- Writes are admin/owner-only (the app still authors via service-role routes).
DROP POLICY IF EXISTS announcements_write ON announcements;
CREATE POLICY announcements_write ON announcements FOR ALL TO authenticated
  USING (is_admin_or_owner()) WITH CHECK (is_admin_or_owner());
