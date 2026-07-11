-- 00041_participants_staff_test_flags.sql
--
-- Pod Squad memo ask (roadmap "Pod Squad batch"; backend doc §6; the
-- prototype's visibleMembers() rule): staff and test accounts are hidden
-- from participant-facing rosters by default, revealed by an explicit
-- toggle. Flags are set by admins (entity explorer / SQL for now — an
-- admin UI control can follow); they are display filters, never
-- permissions.
--
-- DOWN: ALTER TABLE participants DROP COLUMN is_staff, DROP COLUMN is_test;

ALTER TABLE participants ADD COLUMN IF NOT EXISTS is_staff BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
