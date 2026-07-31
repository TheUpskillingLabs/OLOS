-- Merge the three anchor rows with their Luma twins — PROD repair for
-- dev→main promotion day. Run AFTER 00092 has been applied to prod.
--
-- WHY: the seeded anchor rows (api_id anchor-0N) and the Luma-synced rows for
-- the same physical events have coexisted as duplicates on /events, and the
-- seeded rows advertised 6 PM starts when the live Luma events say 4:30 PM
-- (owner decision 2026-07-30: Luma's facts win, titles included). Dev was
-- repaired by hand the same day; this script is the prod twin, plus the
-- event_rsvps move dev didn't need (prod's twins carry the mirrored Luma
-- guest lists — deleting them without moving the rows would break
-- "You're going" for everyone registered).
--
-- The merged rows keep anchor=TRUE and take the twin's api_id + luma_url, so
-- syncLumaEvents() owns them from the next tick (adoption also guards the
-- orphan-archiver, which exempts anchors). Companion code change:
-- lib/cycles/anchor-events.ts carries the same facts (PR after #318).
--
-- Aborts unless exactly 3 twins are found. Idempotent: a re-run finds 0
-- twins (their api_ids now live on the anchor rows, filtered out below)
-- and aborts before touching anything.

BEGIN;

CREATE TEMP TABLE _pairs(anchor_slug text, twin_api_id text);
INSERT INTO _pairs VALUES
  ('kickoff-summit',  'evt-J3EhwlPo69wTyrs'),
  ('meet-the-pods',   'evt-D2UUWX360WzPOhZ'),
  ('showcase-summit', 'evt-YEuCM1lQPuHB48C');

CREATE TEMP TABLE _twins AS
SELECT p.anchor_slug, e.*
FROM _pairs p
JOIN events e ON e.api_id = p.twin_api_id AND NOT e.anchor;

DO $$ BEGIN
  IF (SELECT count(*) FROM _twins) <> 3 THEN
    RAISE EXCEPTION 'expected 3 Luma twins, found % — nothing changed (already merged?)',
      (SELECT count(*) FROM _twins);
  END IF;
END $$;

-- 1. Registrations move to the anchor row (skip emails already on it),
--    then the twin's remainder is deleted with the twin.
UPDATE event_rsvps r
SET event_id = a.id
FROM _twins t
JOIN events a ON a.slug = t.anchor_slug
WHERE r.event_id = t.id
  AND NOT EXISTS (
    SELECT 1 FROM event_rsvps x
    WHERE x.event_id = a.id AND x.email = r.email
  );
DELETE FROM event_rsvps r USING _twins t WHERE r.event_id = t.id;

-- 2. Saved hearts follow (polymorphic by slug, no FK)
UPDATE saved_items si SET slug = t.anchor_slug
FROM _twins t
WHERE si.item_type = 'event' AND si.slug = t.slug
  AND NOT EXISTS (SELECT 1 FROM saved_items x
    WHERE x.participant_id = si.participant_id
      AND x.item_type = 'event' AND x.slug = t.anchor_slug);
DELETE FROM saved_items si USING _twins t
WHERE si.item_type = 'event' AND si.slug = t.slug;

-- 3. The twin dies; the anchor takes its identity and facts
DELETE FROM events WHERE id IN (SELECT id FROM _twins);

UPDATE events a
SET api_id = t.api_id, name = t.name,
    start_at = t.start_at, end_at = t.end_at,
    location_type = t.location_type, location_name = t.location_name,
    img = COALESCE(t.img, a.img),
    luma_url = t.luma_url, synced_at = t.synced_at
FROM _twins t WHERE a.slug = t.anchor_slug;

-- 4. The tz-aware read model follows
UPDATE cycle_events SET occurs_at = '2026-07-14T16:30:00-04:00' WHERE key = 'kickoff'       AND occurs_at = '2026-07-14T18:00:00-04:00';
UPDATE cycle_events SET occurs_at = '2026-08-11T16:30:00-04:00' WHERE key = 'meet_the_pods' AND occurs_at = '2026-08-11T18:00:00-04:00';
UPDATE cycle_events SET occurs_at = '2026-10-13T16:30:00-04:00' WHERE key = 'summit'        AND occurs_at = '2026-10-13T18:00:00-04:00';

COMMIT;

-- Verify: expect the three anchors with evt-* api_ids, 16:30 starts, MLK.
SELECT slug, name, api_id, start_at, end_at, location_name
FROM events WHERE anchor ORDER BY start_at;
