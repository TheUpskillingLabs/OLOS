-- Anchor event date drift check. READ ONLY. Run in Supabase Studio against
-- dev (cethihabtddiujzayaxe) and prod (cdbgkgkjnomjnpicaxqe), compare output.
--
-- "expected" below is lib/cycles/anchor-events.ts, which matches the corrected
-- Cycle 3 calendar in docs/requirements/cycle-timeline.md and the cycle_events
-- seed in 00086. See anchor-date-drift-2026-07-29.md.

WITH expected(slug, start_at, end_at) AS (
  VALUES
    ('kickoff-summit',         '2026-07-14T18:00'::timestamp, '2026-07-14T21:00'::timestamp),
    ('problem-sprint',         '2026-07-25T09:00',            '2026-07-25T13:00'),
    ('meet-the-pods',          '2026-08-11T18:00',            '2026-08-11T20:30'),
    ('hackathon-frame-sprint', '2026-08-13T09:00',            '2026-08-13T18:00'),
    ('meet-the-projects',      '2026-09-08T18:00',            '2026-09-08T20:30'),
    ('showcase-summit',        '2026-10-13T18:00',            '2026-10-13T21:00')
)
SELECT
  e.slug,
  e.name,
  e.kind,
  e.start_at                                        AS live_start,
  x.start_at                                        AS expected_start,
  (e.start_at - x.start_at)                         AS drift,
  e.end_at                                          AS live_end,
  x.end_at                                          AS expected_end,
  e.anchor,
  e.status,
  e.api_id,
  CASE WHEN e.synced_at IS NULL THEN 'local' ELSE 'luma' END AS owner,
  CASE
    WHEN e.slug IS NULL             THEN 'MISSING ROW'
    WHEN e.start_at = x.start_at
     AND e.end_at   = x.end_at      THEN 'ok'
    ELSE                                 'DRIFT'
  END                                               AS verdict
FROM expected x
LEFT JOIN events e ON e.slug = x.slug
ORDER BY x.start_at;

-- Any other rows flagged as anchors that are not one of the six.
SELECT slug, name, start_at, anchor
FROM events
WHERE anchor = TRUE
  AND slug NOT IN ('kickoff-summit','problem-sprint','meet-the-pods',
                   'hackathon-frame-sprint','meet-the-projects','showcase-summit')
ORDER BY start_at;

-- What cycle_events says, for cross-reference (should already be correct).
SELECT c.id AS cycle_id, ce.key, ce.label, ce.occurs_at, ce.luma_api_id
FROM cycle_events ce
JOIN cycles c ON c.id = ce.cycle_id
ORDER BY c.id, ce.occurs_at;

-- Free-text kind values, relevant to the events-page type filter work.
SELECT COALESCE(kind, '(null)') AS kind, COUNT(*) AS n
FROM events
GROUP BY 1
ORDER BY n DESC;
