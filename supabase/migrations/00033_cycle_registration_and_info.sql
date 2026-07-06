-- Civics & Elections launch — let new users register for an UPCOMING cycle,
-- and add cycle information-page content.
-- See docs/user-stories-cycle-registration.md.
--
-- Why:
--  1. Registration was hardwired to the single status='active' cycle. A cycle
--     now advertises sign-ups via a registration window (parallels the existing
--     phase windows and is read by lib/auth/windows.ts checkWindow, field
--     "registration"), so a cycle can accept registrations while still `upcoming`.
--  2. The cycle information page (public /c/[id] and the authenticated
--     /cycles/[id]) renders optional admin-authored copy; NULL falls back to
--     standard "how a Build Cycle works" copy in the app.
--  3. The app now understands the full status vocabulary; reconcile the
--     cycles.status CHECK to match (previously draft/active/closed only, and on
--     some environments an out-of-band 'upcoming' value with a NOT VALID check).

ALTER TABLE cycle_config
  ADD COLUMN IF NOT EXISTS registration_open TIMESTAMP,
  ADD COLUMN IF NOT EXISTS registration_close TIMESTAMP;

ALTER TABLE cycles
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS what_you_build TEXT;

-- Full status set the app now supports. Drop-and-recreate makes this idempotent
-- across environments (some hold a prior NOT VALID variant). Existing rows use
-- draft/upcoming/active/closed, all within the set, so ADD validates cleanly.
ALTER TABLE cycles DROP CONSTRAINT IF EXISTS cycles_status_check;
ALTER TABLE cycles ADD CONSTRAINT cycles_status_check
  CHECK (status IN ('draft', 'upcoming', 'active', 'closing', 'archived', 'closed'));
