-- 00083_handle_desuffix.sql
-- Strip numeric suffixes from participant handles whose base form is free.
--
-- 00044's backfill numbered duplicate slugs ("alex-2", "alex-3") and its
-- collision trigger appends the participant id ("alex-1041"). Testers asked
-- why their profile URL carries a number when no other member shares their
-- name (July 2026 feedback: "Slug numbers — do we need them?"). Rows whose
-- suffix-less base is unclaimed get the clean handle; genuine collisions
-- keep their suffix, and the 00044 trigger still suffixes future collisions.
--
-- One row per base wins (lowest id) when several suffixed rows share a base.
-- Data-only — no DDL, SCHEMA.md unaffected.
--
-- ⚠ Changes /u/[handle] URLs for the de-suffixed rows: previously shared
-- profile links with the numbered form will 404 (no redirect table exists).
-- Weigh that before applying to prod; dev/test data has no meaningful
-- shared links.
--
-- Idempotent + re-runnable: a de-suffixed handle no longer matches '-\d+$'.
--
-- DOWN:
--   Not reversible in general (the pre-migration suffixes are not recorded).
--   Restore from backup if the old handles must come back.

WITH candidates AS (
  SELECT
    id,
    regexp_replace(handle, '-\d+$', '') AS base,
    row_number() OVER (
      PARTITION BY regexp_replace(handle, '-\d+$', '')
      ORDER BY id
    ) AS rn
  FROM participants
  WHERE handle ~ '-\d+$'
)
UPDATE participants p
SET handle = c.base
FROM candidates c
WHERE p.id = c.id
  AND c.rn = 1
  AND c.base <> ''
  AND NOT EXISTS (
    SELECT 1 FROM participants q
    WHERE q.handle = c.base AND q.id <> p.id
  );
