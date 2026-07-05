-- 00050_saved_items.sql
-- The Learning section's "Saved" vertical (onboarding-proto's hearts /
-- userState.saved). A member hearts an event or a library resource; the saved
-- list is the third tab of /learning. Polymorphic-by-slug: the reference is the
-- content item's stable, URL-matching slug (events + resources are both
-- slug-keyed, upserted idempotently by the seed — 00033/00034), so a saved row
-- survives a re-seed and maps 1:1 to /events/{slug} · /library/{slug}.
--
-- Writes go through the service-role route POST /api/saved (toggle, session
-- identity — never client-supplied), but RLS is keyed to current_participant_id()
-- so a member could only ever see/mutate their own rows regardless of path.
--
-- Idempotent + re-runnable.
--
-- DOWN:
--   DROP TABLE IF EXISTS saved_items;

CREATE TABLE IF NOT EXISTS saved_items (
  id             SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  item_type      VARCHAR(20) NOT NULL CHECK (item_type IN ('event', 'resource')),
  slug           VARCHAR(200) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (participant_id, item_type, slug)
);

CREATE INDEX IF NOT EXISTS idx_saved_items_participant
  ON saved_items(participant_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Self only: a member reads, saves, and unsaves their own hearts.
-- current_participant_id() maps the auth JWT → participants.id (00002-era
-- helper, reused by learning_logs 00040).
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_items_select ON saved_items;
CREATE POLICY saved_items_select ON saved_items FOR SELECT
  USING (participant_id = current_participant_id());

DROP POLICY IF EXISTS saved_items_insert ON saved_items;
CREATE POLICY saved_items_insert ON saved_items FOR INSERT
  WITH CHECK (participant_id = current_participant_id());

DROP POLICY IF EXISTS saved_items_delete ON saved_items;
CREATE POLICY saved_items_delete ON saved_items FOR DELETE
  USING (participant_id = current_participant_id());
