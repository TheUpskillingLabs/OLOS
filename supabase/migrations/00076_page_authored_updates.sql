-- 00076_page_authored_updates.sql
-- Pages as first-class feed authors. Until now a profile_updates row was always
-- authored by a person (participant_id NOT NULL). This lets a row be authored by
-- a PAGE instead — a local lab, sector, workstream, pod, or project — so a page's
-- admins can post updates that flow into the feeds of people who follow the page.
-- Announcements are unaffected; they remain their own (right-rail) content type.
--
-- Author is polymorphic (mirrors the follows XOR pattern): exactly one of
--   • participant_id  (a member's own post — the existing path), or
--   • (author_page_type, author_page_id)  (a page post; posted_by_participant_id
--     records which admin actually posted, for provenance).
-- Page posts are always visibility='labs' (public to members); page_id is NOT an
-- FK (polymorphic across metros/sectors/workstreams/pods/projects, validated in
-- the app), like follows.page_id.
--
-- Also: a page_admins table (the "others can be added" list beyond a page's
-- auto-admin leads/members), the follows page_type widened to pods/projects, and
-- a participants flag for the one-time "auto-follow your own groups" seed.
--
-- Idempotent + re-runnable.
--
-- DOWN:
--   ALTER TABLE profile_updates
--     DROP COLUMN IF EXISTS author_page_type,
--     DROP COLUMN IF EXISTS author_page_id,
--     DROP COLUMN IF EXISTS posted_by_participant_id,
--     ALTER COLUMN participant_id SET NOT NULL;
--   DROP TABLE IF EXISTS page_admins;
--   ALTER TABLE participants DROP COLUMN IF EXISTS page_follows_seeded;

-- ── profile_updates: polymorphic author ──────────────────────────────────────
ALTER TABLE profile_updates ALTER COLUMN participant_id DROP NOT NULL;

ALTER TABLE profile_updates
  ADD COLUMN IF NOT EXISTS author_page_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS author_page_id INT,
  ADD COLUMN IF NOT EXISTS posted_by_participant_id INT REFERENCES participants(id);

ALTER TABLE profile_updates
  DROP CONSTRAINT IF EXISTS profile_updates_author_page_type_check;
ALTER TABLE profile_updates
  ADD CONSTRAINT profile_updates_author_page_type_check CHECK (
    author_page_type IS NULL
    OR author_page_type IN ('lab', 'sector', 'workstream', 'pod', 'project')
  );

-- Exactly one author kind. Every legacy row has participant_id set → first branch.
ALTER TABLE profile_updates
  DROP CONSTRAINT IF EXISTS profile_updates_one_author_check;
ALTER TABLE profile_updates
  ADD CONSTRAINT profile_updates_one_author_check CHECK (
    (participant_id IS NOT NULL AND author_page_type IS NULL AND author_page_id IS NULL)
    OR (participant_id IS NULL AND author_page_type IS NOT NULL AND author_page_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_profile_updates_page_author
  ON profile_updates(author_page_type, author_page_id, created_at DESC)
  WHERE author_page_type IS NOT NULL;

-- RLS is unchanged: page posts are visibility='labs', already covered by
-- profile_updates_select (00072); likes/comments key on the parent update.

-- ── page_admins: the explicit admin list per page ────────────────────────────
CREATE TABLE IF NOT EXISTS page_admins (
  id SERIAL PRIMARY KEY,
  page_type VARCHAR(20) NOT NULL
    CHECK (page_type IN ('lab', 'sector', 'workstream', 'pod', 'project')),
  page_id INT NOT NULL,
  participant_id INT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  added_by_participant_id INT REFERENCES participants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_page_admin_active
  ON page_admins(page_type, page_id, participant_id)
  WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_page_admins_page
  ON page_admins(page_type, page_id)
  WHERE removed_at IS NULL;

ALTER TABLE page_admins ENABLE ROW LEVEL SECURITY;

-- Admin rosters aren't sensitive (a page shows who runs it); writes go through a
-- service-role route gated by isPageAdmin.
DROP POLICY IF EXISTS page_admins_select ON page_admins;
CREATE POLICY page_admins_select ON page_admins FOR SELECT
  TO authenticated
  USING (true);

-- ── follows: pods + projects become followable pages ─────────────────────────
ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_page_type;
ALTER TABLE follows
  ADD CONSTRAINT follows_page_type CHECK (
    page_type IS NULL
    OR page_type IN ('sector', 'workstream', 'lab', 'pod', 'project')
  );

-- ── participants: one-time "auto-follow your own groups" seed marker ──────────
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS page_follows_seeded BOOLEAN NOT NULL DEFAULT false;
