-- 00072_profile_update_posts.sql
-- Freeform member posts — the LinkedIn-style composer at the top of the feed.
-- Until now a profile_updates row could only be born from a shared Learning Log
-- (a server-derived paragraph, visibility 'labs', no composer — 00040 owner
-- decision). This opens a direct freeform post with a visibility choice:
--   • public  → visibility 'labs' (the existing members-wide community feed),
--     learning_log_id NULL (not derived from a structured log)
--   • private → visibility 'private' (saved, author-only)
-- Widen the visibility CHECK and let authors read their own private posts.
-- Writes go through a service-role route (POST /api/posts); the shared Learning
-- Log path (00040) is unchanged and still writes 'labs' rows.
--
-- Idempotent + re-runnable.
--
-- DOWN:
--   DELETE FROM profile_updates WHERE visibility = 'private';
--   ALTER TABLE profile_updates DROP CONSTRAINT IF EXISTS profile_updates_visibility_check;
--   ALTER TABLE profile_updates ADD CONSTRAINT profile_updates_visibility_check
--     CHECK (visibility IN ('labs'));
--   DROP POLICY IF EXISTS profile_updates_select ON profile_updates;
--   CREATE POLICY profile_updates_select ON profile_updates FOR SELECT
--     TO authenticated USING (visibility = 'labs');

ALTER TABLE profile_updates DROP CONSTRAINT IF EXISTS profile_updates_visibility_check;
ALTER TABLE profile_updates ADD CONSTRAINT profile_updates_visibility_check
  CHECK (visibility IN ('labs', 'private'));

-- The members-wide feed stays 'labs'-only; authors additionally read their own
-- private posts. (The app reads the feed via the service client, but this keeps
-- the RLS boundary honest — a private post is never visible to anyone else.)
DROP POLICY IF EXISTS profile_updates_select ON profile_updates;
CREATE POLICY profile_updates_select ON profile_updates FOR SELECT
  TO authenticated
  USING (
    visibility = 'labs'
    OR (visibility = 'private' AND participant_id = current_participant_id())
  );
