-- 00074_follows.sql
-- The follow graph — the mechanic behind the "Following" feed. A member follows
-- other members ("users") and org "pages" (a sector, a workstream, or a local
-- lab). The community updates feed is then restricted to updates authored by the
-- users you follow (plus your own); page-follows drive page content into the
-- feed as those surfaces gain posts.
--
-- Polymorphic target: exactly one of a followee participant OR a
-- (page_type, page_id) pair. page_id is intentionally NOT a foreign key — it
-- points at one of three tables (sectors / workstreams / metros) selected by
-- page_type — so it is validated at the app layer, like other scope columns.
--
-- Writes go through a service-role route (POST /api/follows) that binds the
-- follower from the session; RLS keeps the boundary honest (manage only your
-- own follows; you may read rows that target you, for follower counts).
--
-- Idempotent + re-runnable.
--
-- DOWN: DROP TABLE IF EXISTS follows;

CREATE TABLE IF NOT EXISTS follows (
  id SERIAL PRIMARY KEY,
  follower_participant_id INT NOT NULL
    REFERENCES participants(id) ON DELETE CASCADE,
  followee_participant_id INT REFERENCES participants(id) ON DELETE CASCADE,
  page_type VARCHAR(20),
  page_id INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT follows_one_target CHECK (
    (followee_participant_id IS NOT NULL AND page_type IS NULL AND page_id IS NULL)
    OR (followee_participant_id IS NULL AND page_type IS NOT NULL AND page_id IS NOT NULL)
  ),
  CONSTRAINT follows_page_type CHECK (
    page_type IS NULL OR page_type IN ('sector', 'workstream', 'lab')
  ),
  CONSTRAINT follows_no_self CHECK (
    followee_participant_id IS NULL
    OR followee_participant_id <> follower_participant_id
  )
);

-- One follow per (follower, target); split by kind so the partial uniques hold.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_follow_user
  ON follows(follower_participant_id, followee_participant_id)
  WHERE followee_participant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_follow_page
  ON follows(follower_participant_id, page_type, page_id)
  WHERE page_type IS NOT NULL;

-- Feed build reads "who does X follow"; profiles read "who follows page/user Y".
CREATE INDEX IF NOT EXISTS idx_follows_follower
  ON follows(follower_participant_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee
  ON follows(followee_participant_id)
  WHERE followee_participant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_follows_page
  ON follows(page_type, page_id)
  WHERE page_type IS NOT NULL;

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS follows_select ON follows;
CREATE POLICY follows_select ON follows FOR SELECT
  TO authenticated
  USING (
    follower_participant_id = current_participant_id()
    OR followee_participant_id = current_participant_id()
  );

DROP POLICY IF EXISTS follows_insert ON follows;
CREATE POLICY follows_insert ON follows FOR INSERT
  TO authenticated
  WITH CHECK (follower_participant_id = current_participant_id());

DROP POLICY IF EXISTS follows_delete ON follows;
CREATE POLICY follows_delete ON follows FOR DELETE
  TO authenticated
  USING (follower_participant_id = current_participant_id());
