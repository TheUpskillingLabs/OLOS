-- 00039_event_rsvps_hardening.sql
--
-- The public-RSVP abuse guard the backend doc (§3/§8) called load-bearing
-- and flagged as a pre-launch blocker (roadmap Phase 0):
--   - ip_hash: sha256 of the caller's address (never the raw IP); the RSVP
--     route counts rows per hash inside a rolling window before accepting
--     an anonymous write. First consumer of the lib/api/rate-limit pattern.
--   - participant_id (nullable): the member path records identity so member
--     RSVPs are queryable per participant (the Pod Squad memo's
--     workshop-signups view reads this); the anonymous path leaves it NULL.
--
-- DOWN: ALTER TABLE event_rsvps DROP COLUMN ip_hash, DROP COLUMN participant_id;
--       DROP INDEX idx_event_rsvps_ip_window, idx_event_rsvps_participant;

ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS ip_hash TEXT;
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS participant_id INT REFERENCES participants(id);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_ip_window ON event_rsvps(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_participant ON event_rsvps(participant_id);
