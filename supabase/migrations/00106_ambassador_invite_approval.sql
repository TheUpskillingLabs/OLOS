-- 00106_ambassador_invite_approval.sql
--
-- An invite is reviewed before it is extended (owner decision, 2026-10-10).
-- A coordinator drafts an invite; a DIFFERENT coordinator of that Lab (or an
-- admin) approves it. The link works from the start, so the invitee can finish
-- the quiz and agreement meanwhile, but it grants the ambassador role only
-- once approved. Open applications keep the two-reviewer path (00105).
--
-- Invites made before this migration were pre-approved by design, so they are
-- backfilled as approved by their inviter.
--
-- Idempotent + re-runnable.
--
-- DOWN:
--   ALTER TABLE ambassador_invites DROP COLUMN IF EXISTS approved_by;
--   ALTER TABLE ambassador_invites DROP COLUMN IF EXISTS approved_at;

ALTER TABLE ambassador_invites ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE ambassador_invites ADD COLUMN IF NOT EXISTS approved_by integer REFERENCES participants(id) ON DELETE SET NULL;

UPDATE ambassador_invites
   SET approved_at = created_at, approved_by = invited_by
 WHERE approved_at IS NULL;
