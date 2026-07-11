-- 00073_profile_update_social.sql
-- Likes + comments on community feed updates (profile_updates) — the LinkedIn-
-- style social layer beneath each post. Two tables:
--   • profile_update_likes    — a per-member like TOGGLE (UNIQUE per update).
--   • profile_update_comments — short freeform replies.
-- Both hang off profile_updates and cascade-delete with it (and with the
-- participant). Reactions are a single "like" for now; the shape leaves room to
-- grow into multi-emoji later without a rewrite.
--
-- Reads happen through the members feed (service-role, poster allowlist) and
-- writes through service-role API routes that bind the author from the session
-- (POST/DELETE /api/updates/[id]/like, /api/updates/[id]/comments). RLS still
-- makes the boundary honest: a like/comment is only visible when its parent
-- update is (labs-wide, or the viewer's own private post), and a member may only
-- write/remove their own rows.
--
-- Idempotent + re-runnable. set_updated_at() is defined in 00037.
--
-- DOWN:
--   DROP TABLE IF EXISTS profile_update_comments;
--   DROP TABLE IF EXISTS profile_update_likes;

CREATE TABLE IF NOT EXISTS profile_update_likes (
  id SERIAL PRIMARY KEY,
  update_id INT NOT NULL REFERENCES profile_updates(id) ON DELETE CASCADE,
  participant_id INT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (update_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_update_likes_update
  ON profile_update_likes(update_id);

CREATE TABLE IF NOT EXISTS profile_update_comments (
  id SERIAL PRIMARY KEY,
  update_id INT NOT NULL REFERENCES profile_updates(id) ON DELETE CASCADE,
  participant_id INT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Feed reads pull all comments for a page of updates, oldest-first.
CREATE INDEX IF NOT EXISTS idx_profile_update_comments_update
  ON profile_update_comments(update_id, created_at);

DROP TRIGGER IF EXISTS trg_profile_update_comments_updated_at
  ON profile_update_comments;
CREATE TRIGGER trg_profile_update_comments_updated_at
  BEFORE UPDATE ON profile_update_comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE profile_update_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_update_comments ENABLE ROW LEVEL SECURITY;

-- Visible only when the parent update is visible to the viewer (mirrors
-- profile_updates_select from 00072). Write/remove only your own row.
DROP POLICY IF EXISTS profile_update_likes_select ON profile_update_likes;
CREATE POLICY profile_update_likes_select ON profile_update_likes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profile_updates u
      WHERE u.id = update_id
        AND (
          u.visibility = 'labs'
          OR (u.visibility = 'private'
              AND u.participant_id = current_participant_id())
        )
    )
  );

DROP POLICY IF EXISTS profile_update_likes_insert ON profile_update_likes;
CREATE POLICY profile_update_likes_insert ON profile_update_likes FOR INSERT
  TO authenticated
  WITH CHECK (participant_id = current_participant_id());

DROP POLICY IF EXISTS profile_update_likes_delete ON profile_update_likes;
CREATE POLICY profile_update_likes_delete ON profile_update_likes FOR DELETE
  TO authenticated
  USING (participant_id = current_participant_id());

DROP POLICY IF EXISTS profile_update_comments_select ON profile_update_comments;
CREATE POLICY profile_update_comments_select ON profile_update_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profile_updates u
      WHERE u.id = update_id
        AND (
          u.visibility = 'labs'
          OR (u.visibility = 'private'
              AND u.participant_id = current_participant_id())
        )
    )
  );

DROP POLICY IF EXISTS profile_update_comments_insert ON profile_update_comments;
CREATE POLICY profile_update_comments_insert ON profile_update_comments FOR INSERT
  TO authenticated
  WITH CHECK (participant_id = current_participant_id());

DROP POLICY IF EXISTS profile_update_comments_delete ON profile_update_comments;
CREATE POLICY profile_update_comments_delete ON profile_update_comments FOR DELETE
  TO authenticated
  USING (participant_id = current_participant_id());
