-- 00042_testers.sql
--
-- The testing pathway (owner ask, July 2026): an admin can flag an account
-- as a tester; a tester can reset their own account — every journey row
-- deleted, participants row included — and walk the whole onboarding again
-- (funnel → cycle ceremony → pods → logs), as many times as they like.
--
-- The grant is EMAIL-keyed here (not participant-keyed) precisely because
-- a full reset deletes the participants row: when the tester re-registers,
-- the funnel looks their email up in this table and re-applies
-- participants.is_test automatically — grant once, reset forever.
-- is_test (00041) remains the row-level flag the UI reads: testers are
-- hidden from rosters and excluded from pod health math.
--
-- Service-role only (RLS enabled, no policies): written by
-- POST/DELETE /api/admin/testers, read by the registration funnel.
--
-- DOWN: DROP TABLE testers;

CREATE TABLE IF NOT EXISTS testers (
  email TEXT PRIMARY KEY CHECK (email = LOWER(email)),
  granted_by INT REFERENCES participants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE testers ENABLE ROW LEVEL SECURITY;
