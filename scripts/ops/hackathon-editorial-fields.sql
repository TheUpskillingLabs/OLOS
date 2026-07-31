-- Hackathon editorial fields, after the bespoke route was retired
-- (Phase 4 of docs/proposals/luma-driven-event-pages.md).
--
-- WHY: /events/civics-elections-hackathon is now served by /events/[slug],
-- which renders Luma's About text. Two things on the old hand-built page were
-- never Luma's to give: the numeral row ("12 weeks per Build Cycle"...) and the
-- American University sponsor logo. Luma renders sponsor logos on its own page
-- but does not expose them through the API, and it has no concept of a stat row
-- at all. Migration 00095 added `stats` and `sponsors` as EDITORIAL columns for
-- exactly this: fill-only, never touched by the sync (see the ownership list in
-- lib/integrations/luma.ts's header).
--
-- Run against dev first, then prod at promotion time. Ops SQL, not a migration:
-- this is content for one row, not schema.
--
-- Prereq: 00095 must be applied. Check with
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'events' AND column_name IN
--          ('location_address','meeting_url','sponsors','stats');
-- Expect 4 rows.

-- 1. Diagnostic. `body` must be empty or NULL: app/(public)/events/[slug]/page.tsx
--    suppresses `about` whenever `body` is set, so a leftover body silently wins
--    and the Luma copy never appears.
SELECT slug,
       body,
       stats,
       sponsors,
       length(about)          AS about_chars,
       location_address,
       synced_at
  FROM events
 WHERE slug = 'civics-elections-hackathon';

-- 2. If `body` is non-empty, clear it so About shows. Do this deliberately:
--    whatever is in `body` was hand-written editorial copy.
-- UPDATE events SET body = NULL WHERE slug = 'civics-elections-hackathon';

-- 3. The numeral row and the sponsor wall.
--    `bg` is omitted: the AU lockup is dark-on-transparent and reads fine on the
--    warm paper. Knockout art (white-on-transparent) would need "bg": "dark".
UPDATE events
   SET stats = '[
         {"n": "12", "label": "weeks per Build Cycle"},
         {"n": "1",  "label": "day, idea to prototype"},
         {"n": "2",  "label": "tracks, newcomer and Pod sprint"},
         {"n": "0",  "label": "credentials required"}
       ]'::jsonb,
       sponsors = '[
         {"src": "/assets/american-university.webp", "alt": "American University"}
       ]'::jsonb
 WHERE slug = 'civics-elections-hackathon';

-- 4. Confirm.
SELECT slug, stats, sponsors FROM events WHERE slug = 'civics-elections-hackathon';
