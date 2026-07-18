-- 00089_one_survey_per_cycle.sql
--
-- Affiliate every field survey with a cycle (owner decision 2026-07-14):
-- creating a survey now requires choosing its cycle, and a cycle carries at
-- most ONE survey. The dashboard and cycle pages resolve "this cycle's
-- survey" via getFieldSurveyForCycle (lib/content/surveys.ts); a 1:1 link
-- keeps that resolution unambiguous instead of "newest open survey wins".
--
-- Enforced as a PARTIAL unique index: cycle_id stays nullable because
-- pre-00089 rows may not have a cycle yet (the two shipped surveys were
-- created with cycle_id NULL — backfill them by slug, see below) and the
-- sector-commons fallback remains legal. The "required at creation" rule is
-- application-layer (createSurveySchema + the admin form), where it can give
-- a usable error; the index is the data-integrity backstop.
--
-- Backfill (run once per environment after applying; not in the migration
-- because it matches live rows by name — data repair, not schema):
--   UPDATE field_surveys fs SET cycle_id = c.id
--   FROM cycles c
--   WHERE fs.share_slug = 'civics' AND c.name = 'Civics & Elections'
--     AND fs.cycle_id IS NULL;
--
-- DOWN:
--   DROP INDEX IF EXISTS uq_field_surveys_cycle;

CREATE UNIQUE INDEX IF NOT EXISTS uq_field_surveys_cycle
  ON field_surveys (cycle_id)
  WHERE cycle_id IS NOT NULL;
