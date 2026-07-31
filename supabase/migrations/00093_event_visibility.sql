-- Members-only events: a visibility axis alongside status.
--
-- WHY: the Luma sync runs with a calendar-admin API key, so list-events
-- returns PRIVATE events too (build-cycle dry runs, member check-ins), and
-- the sync was publishing them to the public /events page. But hiding them
-- entirely is wrong the other way: members should still find them under
-- /learning (owner call, 2026-07-30). Deleting them at fetch also meant
-- reconciliation would archive them -- gone for everyone. So visibility
-- becomes data, not a filter:
--
--   visibility = 'public'  -> everyone (the default)
--   visibility = 'members' -> signed-in surfaces only (/learning, detail
--                             pages for signed-in visitors)
--
-- The sync owns the column from the Luma event's own visibility field and
-- only writes it when Luma sends the field -- absent means "leave as is",
-- never "expose". Until the first post-deploy sync tick, previously imported
-- private events remain visibility='public'; the tick corrects them.
--
-- RLS: the anon policy tightens to public-only; a new authenticated policy
-- keeps every published row readable to signed-in members. (App reads go
-- through the service client, so these matter for direct PostgREST access --
-- defense in depth, but the kind that counts.)

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'public';

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_visibility_check;
ALTER TABLE events
  ADD CONSTRAINT events_visibility_check
  CHECK (visibility IN ('public', 'members'));

DROP POLICY IF EXISTS events_public_read ON events;
CREATE POLICY events_public_read ON events
  FOR SELECT USING (status = 'published' AND visibility = 'public');

DROP POLICY IF EXISTS events_member_read ON events;
CREATE POLICY events_member_read ON events
  FOR SELECT TO authenticated USING (status = 'published');

-- DOWN (reference only):
--   DROP POLICY IF EXISTS events_member_read ON events;
--   DROP POLICY IF EXISTS events_public_read ON events;
--   CREATE POLICY events_public_read ON events
--     FOR SELECT USING (status = 'published');
--   ALTER TABLE events DROP CONSTRAINT IF EXISTS events_visibility_check;
--   ALTER TABLE events DROP COLUMN IF EXISTS visibility;
