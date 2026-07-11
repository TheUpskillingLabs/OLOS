-- 00077_project_follow_unification.sql
-- One Follow concept for projects. The project page's "Follow" button used to
-- write project_subscriptions (00060's IC-ladder recruiting pool) while the
-- Following feed reads the follows graph (00074/00076) — so following a project
-- never put its posts in your feed, and the follower count/recruiting pool
-- answered to a different population than the feed audience.
--
-- Fix: back-fill every existing subscription into the follows graph so previous
-- followers keep (and finally get) what they signed up for. The app now renders
-- the standard FollowButton (follows graph) on the project page and sources the
-- follower count + the DRI's add-contributor pool from follows. The
-- project_subscriptions table stays in place, dormant, for history/git-blame —
-- nothing writes or reads it after this change.
--
-- Idempotent + re-runnable (NOT EXISTS guard).
--
-- DOWN:
--   DELETE FROM follows f USING project_subscriptions ps
--   WHERE f.page_type = 'project' AND f.page_id = ps.project_id
--     AND f.follower_participant_id = ps.participant_id;

INSERT INTO follows (follower_participant_id, page_type, page_id)
SELECT ps.participant_id, 'project', ps.project_id
FROM project_subscriptions ps
WHERE NOT EXISTS (
  SELECT 1 FROM follows f
  WHERE f.follower_participant_id = ps.participant_id
    AND f.page_type = 'project'
    AND f.page_id = ps.project_id
);
