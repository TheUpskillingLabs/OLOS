-- PROD repair #2, 2026-07-30 evening: restore the archived anchors and merge
-- the two twins the first pass (anchor-luma-merge-2026-07-30.sql) didn't cover.
--
-- WHAT HAPPENED: before this release deployed, the old sync's reconciliation
-- had been archiving the anchor rows for weeks (anchor-0N api_ids never match
-- a Luma listing; the deployed fix exempts anchors). The first merge pass ran
-- against those archived rows -- correct merges, invisible results -- and prod
-- had two twins dev never had: the hackathon (synced long ago) and a new
-- Meet the Projects. This script merged both, re-published every anchor, and
-- aligned cycle_events. Run AFTER the new code was live, so the archiver
-- could not re-eat the restored rows. Idempotent: re-run finds 0 twins and
-- aborts. See the same-day session notes; companion code: the
-- idea-to-prototype redirect in next.config.ts + meet-the-projects facts in
-- anchor-events.ts (fix/anchor-luma-facts branch).

BEGIN;

CREATE TEMP TABLE _pairs(anchor_slug text, twin_api_id text);
INSERT INTO _pairs VALUES
  ('civics-elections-hackathon', 'evt-6e57Zn5jBAJIdRZ'),
  ('meet-the-projects',          'evt-XlbDYoVjUAftbv1');

CREATE TEMP TABLE _twins AS
SELECT p.anchor_slug, e.* FROM _pairs p
JOIN events e ON e.api_id = p.twin_api_id AND NOT e.anchor;

DO $$ BEGIN
  IF (SELECT count(*) FROM _twins) <> 2 THEN
    RAISE EXCEPTION 'expected 2 twins, found % -- nothing changed',
      (SELECT count(*) FROM _twins);
  END IF;
END $$;

UPDATE event_rsvps r SET event_id = a.id
FROM _twins t JOIN events a ON a.slug = t.anchor_slug
WHERE r.event_id = t.id
  AND NOT EXISTS (SELECT 1 FROM event_rsvps x
    WHERE x.event_id = a.id AND x.email = r.email);
DELETE FROM event_rsvps r USING _twins t WHERE r.event_id = t.id;

UPDATE saved_items si SET slug = t.anchor_slug
FROM _twins t
WHERE si.item_type = 'event' AND si.slug = t.slug
  AND NOT EXISTS (SELECT 1 FROM saved_items x
    WHERE x.participant_id = si.participant_id
      AND x.item_type = 'event' AND x.slug = t.anchor_slug);
DELETE FROM saved_items si USING _twins t
WHERE si.item_type = 'event' AND si.slug = t.slug;

DELETE FROM events WHERE id IN (SELECT id FROM _twins);

UPDATE events a
SET api_id = t.api_id, name = t.name,
    start_at = t.start_at, end_at = t.end_at,
    location_type = t.location_type, location_name = t.location_name,
    img = COALESCE(t.img, a.img),
    luma_url = t.luma_url, synced_at = t.synced_at
FROM _twins t WHERE a.slug = t.anchor_slug;

-- The key line: bring every anchor back from the archive.
UPDATE events SET status = 'published' WHERE anchor AND status = 'archived';

UPDATE cycle_events SET occurs_at = '2026-09-08T16:45:00-04:00'
WHERE key = 'meet_the_projects' AND occurs_at = '2026-09-08T18:00:00-04:00';

COMMIT;

-- Verify: six anchors, all published, evt-* api_ids where a Luma twin exists.
SELECT slug, name, api_id, start_at, end_at, status
FROM events WHERE anchor ORDER BY start_at;
