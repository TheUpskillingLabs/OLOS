-- Luma sync bookkeeping (backend doc §3: events is a cache, Luma stays
-- authoritative once the live sync runs). synced_at marks a row as
-- Luma-managed (NULL = editorial/seeded row the sync never created);
-- luma_url links back to the event's Luma page for RSVP parity checks.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS luma_url VARCHAR(500);
