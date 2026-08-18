-- 00101_event_rsvps_participant_backfill.sql
--
-- Attribute already-mirrored Luma RSVPs to the members who made them.
--
-- `event_rsvps.participant_id` (00039) is written only by the in-app one-tap
-- path (MemberRegister -> POST /api/events/[event_id]/rsvp). Every row the
-- Luma guest mirror creates is email-only, so a member who registered on
-- Luma's own page ends up with an RSVP row that cannot be tied back to their
-- account. Two consequences, both silent:
--
--   * getPodWorkshops() (lib/moderator/workshops.ts) reads
--     .in("participant_id", memberIds), so it has been UNDERCOUNTING pod
--     workshop signups ever since the guest mirror shipped. The public event
--     page deliberately sends anonymous visitors to Luma, which makes the
--     mirror the majority path, not the edge case.
--   * a member-facing "workshops you are registered for" list would come back
--     empty for anyone who registered on Luma rather than in-app.
--
-- participants.email is UNIQUE and is stored lowercased throughout the app
-- (see /api/admin/testers, /api/invitations, /api/registrations/funnel), so
-- this join is unambiguous. Idempotent: re-running only touches rows that are
-- still NULL. New rows get the same resolution at mirror time, in
-- lib/integrations/luma.ts.
--
-- No schema change here. Both the column and idx_event_rsvps_participant
-- already exist (00039); this migration is pure data repair.
--
-- DOWN: irreversible by design. Once applied, a backfilled participant_id is
--       indistinguishable from one written by the in-app path, so there is
--       nothing safe to revert to. Restore from a snapshot if needed.

UPDATE event_rsvps r
   SET participant_id = p.id
  FROM participants p
 WHERE r.participant_id IS NULL
   AND lower(r.email) = lower(p.email);
