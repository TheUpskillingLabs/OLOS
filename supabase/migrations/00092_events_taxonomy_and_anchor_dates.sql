-- Events page refresh: correct anchor dates, give every event a filterable
-- kind, and re-cast the cycle hackathon as the public Aug 15 event.
--
-- WHY (three problems, one table):
--
-- 1. Date drift. `scripts/ops/anchor-date-drift-2026-07-29.md` documented that
--    four of the six anchor rows still carry the prototype dates seeded by
--    00034 and never received the calendar correction that
--    `lib/cycles/anchor-events.ts` and 00086's `cycle_events` did. The public
--    site showed Meet the Pods a week late and the hackathon 26 days late,
--    while the dashboard, the Open Cycle Agreement and the .ics download all
--    showed the corrected dates. These are in-person, venue-bound events people
--    commit to attending, so the two sources have to agree. The 00034 rows carry
--    api_id values anchor-01..06 that never match a Luma api_id, so
--    syncLumaEvents() treats them as local-only and will not heal this itself.
--
-- 2. No usable kind taxonomy. Only the six anchors had a `kind` at all
--    ('Summit' / 'Cycle event'); the eight workshop rows were NULL. The events
--    page filters need buckets every row actually falls into, so kind becomes
--    two values -- 'Anchor' for the cycle spine, 'Workshop' for everything
--    else -- NOT NULL, DEFAULT 'Workshop', with a CHECK.
--
--    The default is the point. Luma syncs several times a day and
--    syncLumaEvents() does not set `kind` on insert (it treats it as a local
--    annotation), so under a nullable column every imported event would land
--    unclassified and match no chip -- invisible to the filters until someone
--    tagged it by hand, forever. Defaulting to 'Workshop' means an import is
--    filterable the moment it arrives, and the only manual act is promoting
--    something to 'Anchor'.
--
-- 3. The hackathon is now a public, co-hosted event. "Hackathon -- the Frame
--    Sprint" on Sep 8 at Main branch becomes "Idea to Prototype: A Civics and
--    Elections Hackathon", Sat Aug 15 2026, 9:00 to 16:30, at American
--    University Constitution Hall, co-hosted with AU, with its own landing page
--    at /events/civics-elections-hackathon. The slug moves with it; the old
--    path is redirected in next.config.ts.
--
-- Idempotent and slug-keyed throughout. No other columns touched; updated_at is
-- left to the set_updated_at() trigger (00037), never hand-set.
--
-- ONE CONSEQUENCE TO KNOW ABOUT: 00034 advertises itself as re-runnable, and
-- for events it no longer is. Its rows carry the pre-taxonomy kinds ('Summit',
-- 'Cycle event') that the CHECK below now rejects, and its anchor-03 upsert
-- targets ON CONFLICT (slug) -- a slug this migration renames -- so it would
-- fall through to a plain INSERT and collide on the api_id unique index. A
-- clean `supabase db reset` is fine (00034 runs first, 00092 corrects it);
-- only the manual "re-run 00034 to refresh content" path is dead. Refresh
-- event content with a new forward migration instead.
-- Companion code change: lib/cycles/anchor-events.ts carries the same dates.

BEGIN;

-- ── 1. Anchor dates ───────────────────────────────────────────────────────
-- Source of truth: docs/requirements/cycle-timeline.md, Cycle 3 calendar, as
-- already encoded in lib/cycles/anchor-events.ts and 00086's cycle_events --
-- with the one exception of the hackathon, which moves for the first time
-- here (see 2 and 3 below; the timeline doc is updated in the same PR).
-- kickoff-summit and showcase-summit were already correct; they are listed so
-- this file is a complete statement of the cycle calendar, not a diff.

UPDATE events e
SET start_at = v.start_at::timestamp,
    end_at   = v.end_at::timestamp
FROM (VALUES
  ('kickoff-summit',         '2026-07-14T18:00', '2026-07-14T21:00'),
  ('problem-sprint',         '2026-07-25T09:00', '2026-07-25T13:00'),
  ('meet-the-pods',          '2026-08-11T18:00', '2026-08-11T20:30'),
  ('hackathon-frame-sprint', '2026-08-15T09:00', '2026-08-15T16:30'),
  ('meet-the-projects',      '2026-09-08T18:00', '2026-09-08T20:30'),
  ('showcase-summit',        '2026-10-13T18:00', '2026-10-13T21:00')
) AS v(slug, start_at, end_at)
WHERE e.slug = v.slug
  AND (e.start_at IS DISTINCT FROM v.start_at::timestamp
    OR e.end_at   IS DISTINCT FROM v.end_at::timestamp);

-- ── 2. The hackathon becomes its own public event ─────────────────────────
-- Runs after the date update above (which still keys on the old slug) and is
-- guarded so a re-run after the rename is a no-op.

UPDATE events
SET slug          = 'civics-elections-hackathon',
    name          = 'Idea to Prototype: A Civics and Elections Hackathon',
    start_at      = '2026-08-15T09:00'::timestamp,
    end_at        = '2026-08-15T16:30'::timestamp,
    location_type = 'in_person',
    -- ZIP included on purpose: cityOf() (lib/content/format.ts) looks for a
    -- "ST ZIP" segment to pull the city out for the compact teaser cards,
    -- and falls back to printing the whole string when it can't find one.
    location_name = 'American University, Constitution Hall, Washington, DC 20016',
    cost          = 'Free',
    host          = 'American University & The Upskilling Labs',
    luma_url      = 'https://luma.com/bgow5pki',
    description   = 'A free, one-day event where you go from idea to working prototype, with real teammates, real tools, and a real plan to test what you build.',
    body          = '["Two tracks share one day. The Newcomer track is a beginner-friendly morning of hands-on AI work: no prior experience needed, and you leave with something you actually built. The Pod sprint track is a structured, full-day problem-solving sprint for Upskillers already in the Civics & Elections Build Cycle.","Both tracks converge in the afternoon for prototype presentations. By 4:30 PM everyone leaves with a working prototype and a plan to test it in the real world. Non-partisan, non-political, and free."]'::jsonb,
    bring         = 'A laptop and an open mind. No AI experience required.'
WHERE slug = 'hackathon-frame-sprint'
  -- slug is UNIQUE; if someone hand-created the new row on dev while this was
  -- being written, skip rather than abort the whole migration.
  AND NOT EXISTS (
    SELECT 1 FROM events WHERE slug = 'civics-elections-hackathon'
  );

-- Saved hearts follow the rename. saved_items is polymorphic by slug with no
-- FK (00050), so without this every member who hearted the Frame Sprint gets a
-- dead row: the card reads un-saved and the item silently leaves their Saved
-- vertical. The NOT EXISTS respects UNIQUE (participant_id, item_type, slug)
-- for anyone who somehow saved both.
UPDATE saved_items si
SET slug = 'civics-elections-hackathon'
WHERE si.item_type = 'event'
  AND si.slug = 'hackathon-frame-sprint'
  AND NOT EXISTS (
    SELECT 1 FROM saved_items dup
    WHERE dup.participant_id = si.participant_id
      AND dup.item_type = 'event'
      AND dup.slug = 'civics-elections-hackathon'
  );

DELETE FROM saved_items
WHERE item_type = 'event' AND slug = 'hackathon-frame-sprint';

-- ── 2b. Cover art ─────────────────────────────────────────────────────────
-- The featured strip puts three anchor cards at the top of /events at full
-- card width, where the orb-gradient fallback is a weak first impression. Only
-- Meet the Pods has a real photo so far (public/assets/meet-the-pods.webp, a
-- resized/optimised crop of the same shoot as the landing hero) — the rest keep
-- the orb until there is art worth using, which is the intended behaviour of
-- the image-or-orb pattern, not a gap.
--
-- Paths are stored without a leading slash to match the 00034 seed;
-- MediaFrame (app/components/content/teasers.tsx) normalises either form.

UPDATE events
SET img = 'assets/meet-the-pods.webp'
WHERE slug = 'meet-the-pods' AND img IS DISTINCT FROM 'assets/meet-the-pods.webp';

-- The hackathon's cover is its live Luma card (the event page's own square
-- crop). Guarded on img IS NULL so a later Luma sync -- which owns `img` once
-- it adopts the row by luma_url -- is never fought by a migration re-run.
UPDATE events
SET img = 'https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=2,background=white,quality=75,width=400,height=400/uploads/ks/b17bf7be-3d74-4751-8f31-d71661b795ce.png'
WHERE slug = 'civics-elections-hackathon' AND img IS NULL;

-- ── 3. The cycle read model keeps up ──────────────────────────────────────
-- cycle_events (00086) is the tz-aware read model for the same calendar. It
-- has no reader in app code yet, but leaving it on the old date would recreate
-- exactly the two-sources-disagree condition this migration exists to end.
-- Stored as timestamptz at America/New_York, matching 00086's style.
--
-- The software-action windows that cycle-timeline.md derives from the
-- hackathon are unaffected: "Tuesday after", "Thursday after" and "2nd Tuesday
-- after" all resolve to Aug 18 / Aug 20 / Aug 25 from either Thu Aug 13 or
-- Sat Aug 15, because both fall in the same week.

UPDATE cycle_events
SET label     = 'Idea to Prototype: A Civics and Elections Hackathon',
    occurs_at = '2026-08-15T09:00:00-04:00'::timestamptz
WHERE key = 'hackathon'
  AND occurs_at = '2026-08-13T09:00:00-04:00'::timestamptz;

-- ── 4. Kind taxonomy ──────────────────────────────────────────────────────
-- Two buckets, derived from the `anchor` flag rather than typed out per slug:
-- the cycle spine is 'Anchor', everything else is 'Workshop'. Every prior
-- value ('Summit', 'Cycle event', NULL, anything a Luma import or a hand edit
-- left behind) is overwritten, so this is a total assignment with nothing left
-- to fall through.
--
-- `anchor` and `kind` are two columns saying one thing, which is redundancy
-- worth naming: `anchor` stays the machine-readable flag the featured strip
-- and the sync exemption read, `kind` is the human-facing label the card tag
-- and the filter chip show. Flipping `anchor` on a row does not move `kind`;
-- do both, or fold them together in a later migration.

UPDATE events
SET kind = CASE WHEN anchor THEN 'Anchor' ELSE 'Workshop' END
WHERE kind IS DISTINCT FROM (CASE WHEN anchor THEN 'Anchor' ELSE 'Workshop' END);

-- DEFAULT before NOT NULL so the constraint holds for inserts that omit the
-- column -- which is every insert syncLumaEvents() makes.
ALTER TABLE events ALTER COLUMN kind SET DEFAULT 'Workshop';
ALTER TABLE events ALTER COLUMN kind SET NOT NULL;

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_kind_check;
ALTER TABLE events
  ADD CONSTRAINT events_kind_check
  CHECK (kind IN ('Anchor', 'Workshop'));

COMMIT;

-- DOWN (for reference only -- real rollbacks ship as a new forward migration):
--   ALTER TABLE events DROP CONSTRAINT IF EXISTS events_kind_check;
--   ALTER TABLE events ALTER COLUMN kind DROP NOT NULL;
--   ALTER TABLE events ALTER COLUMN kind DROP DEFAULT;
--   UPDATE events SET slug='hackathon-frame-sprint',
--                     name='Hackathon — the Frame Sprint',
--                     kind='Cycle event'  -- after dropping the CHECK above
--    WHERE slug='civics-elections-hackathon';
--   UPDATE saved_items SET slug='hackathon-frame-sprint'
--    WHERE item_type='event' AND slug='civics-elections-hackathon';
--   -- Do NOT re-run 00034 to restore dates (see the header note); write the
--   -- old start_at/end_at values explicitly instead.
