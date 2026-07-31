-- Hackathon editorial fields, after the bespoke route was retired
-- (Phase 4 of docs/proposals/luma-driven-event-pages.md).
--
-- WHY: /events/civics-elections-hackathon is now served by /events/[slug],
-- which renders Luma's About text. The numeral row ("12 weeks per Build
-- Cycle"...) was on the old hand-built page and is not something Luma can
-- express, so it moves to the editorial `stats` column added by 00095:
-- fill-only, never touched by the sync (see the ownership list in
-- lib/integrations/luma.ts's header).
--
-- SPONSOR LOGOS ARE DELIBERATELY NOT SET HERE (owner rule, 2026-07-31). The
-- Luma event page shows no sponsor logos, so neither does ours: a logo on the
-- site that is not on the event's own page is us asserting a sponsorship
-- nobody confirmed. The `sponsors` column and the tile renderer exist and work;
-- they stay empty until the logo appears in Luma. The UPDATE below is left
-- commented out for that day.
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

-- 3. The numeral row.
UPDATE events
   SET stats = '[
         {"n": "12", "label": "weeks per Build Cycle"},
         {"n": "1",  "label": "day, idea to prototype"},
         {"n": "2",  "label": "tracks, newcomer and Pod sprint"},
         {"n": "0",  "label": "credentials required"}
       ]'::jsonb
 WHERE slug = 'civics-elections-hackathon';

-- 4. Sponsor logos: ONLY once the logo is on the Luma event page. `bg` marks
--    knockout art (white-on-transparent), which is invisible on the warm paper
--    without it; the AU lockup is colour-on-light and needs no flag.
-- UPDATE events
--    SET sponsors = '[
--          {"src": "/assets/american-university.webp", "alt": "American University"}
--        ]'::jsonb
--  WHERE slug = 'civics-elections-hackathon';

-- 5. Confirm.
SELECT slug, stats, sponsors FROM events WHERE slug = 'civics-elections-hackathon';
