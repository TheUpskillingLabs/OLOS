-- ROADMAP §1.1 / ISSUE-W1-001
-- Extend participants for legacy field parity.
--
-- Adds the eight fields the legacy registration form collects but the current
-- schema discards, so the W1-004 migration script can write all spreadsheet
-- columns without dropping data.
--
-- comms_consent defaults TRUE because every legacy row agreed to comms before
-- submission was accepted; backfill is safe.
-- email_updates is nullable because the legacy form's question wording shifted
-- mid-cycle and "no answer" is a meaningful state.
--
-- IF NOT EXISTS guards make the migration idempotent against partial application.
-- Single ALTER TABLE batches the eight column adds into one catalog rewrite.
-- Postgres 11+ treats ADD COLUMN ... DEFAULT as metadata-only (no full table
-- rewrite), so this is safe to run on a populated participants table.

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS phone_number         VARCHAR(50),
  ADD COLUMN IF NOT EXISTS email_updates        BOOLEAN,
  ADD COLUMN IF NOT EXISTS comms_consent        BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS availability_notes   TEXT,
  ADD COLUMN IF NOT EXISTS commitment_notes     TEXT,
  ADD COLUMN IF NOT EXISTS interest_areas       TEXT,
  ADD COLUMN IF NOT EXISTS moderator_experience TEXT,
  ADD COLUMN IF NOT EXISTS notes                TEXT;

-- DOWN: rollback block. Copy into a scratch query to revert in dev.
-- Not auto-applied; Supabase migrations are forward-only. A real rollback
-- ships as a new forward migration so the history stays linear.
--
-- ALTER TABLE participants
--   DROP COLUMN IF EXISTS phone_number,
--   DROP COLUMN IF EXISTS email_updates,
--   DROP COLUMN IF EXISTS comms_consent,
--   DROP COLUMN IF EXISTS availability_notes,
--   DROP COLUMN IF EXISTS commitment_notes,
--   DROP COLUMN IF EXISTS interest_areas,
--   DROP COLUMN IF EXISTS moderator_experience,
--   DROP COLUMN IF EXISTS notes;
