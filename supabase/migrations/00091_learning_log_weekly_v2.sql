-- 00091_learning_log_weekly_v2.sql
--
-- The weekly Learning Log's second instrument (owner redesign, branch
-- claude/weekly-learning-log-questions-wvw91f). The v1 ritual (clarity /
-- alignment health check + three reflection prompts) is replaced FOR THE
-- WEEKLY OPEN-CYCLE LOG ONLY by nine items:
--   1a stuck? (reuses is_blocked)  1b what have you tried (stuck_tried)
--   1c what help would move it (reuses blocker_context — same "what do
--      you need" contract the Poderator blocked-first rollup renders)
--   2  hours_bucket — the onboarding availability buckets, byte-identical
--      to option_lists('availability') / 00082 (validated app-side against
--      lib/cycles/hours.ts; no FK — 00082 rebuilt that list once already,
--      and history must survive a future rebuild or deactivation)
--   3  collab_rating 1–5 (phase-contextual stem, UI-only)
--   4a progress_rating 1–5    4b contribution (phase-contextual stem)
--   5  learned                 6 capability_rating 1–5
--   7  energy_rating 1–5       8 feeling_word (optional, single word)
--   9  recognition (optional shout-out)
--
-- Milestone reviews, journal logs, and org-cycle logs keep the v1 shape,
-- so clarity/alignment stay written for those kinds — they only lose NOT
-- NULL (their 1–5 CHECKs pass on NULL). Per-kind requiredness is enforced
-- in app code (kind is server-derived; lib/validations/learning-logs.ts),
-- not in DDL. New weekly rows are stamped schema_version='v2' by the
-- route; existing rows are untouched (append-only table).
--
-- DOWN: ALTER TABLE learning_logs
--         DROP COLUMN stuck_tried, DROP COLUMN hours_bucket,
--         DROP COLUMN collab_rating, DROP COLUMN progress_rating,
--         DROP COLUMN contribution, DROP COLUMN learned,
--         DROP COLUMN capability_rating, DROP COLUMN energy_rating,
--         DROP COLUMN feeling_word, DROP COLUMN recognition;
--       Restoring NOT NULL on clarity/alignment first needs a backfill of
--       v2 rows, e.g. UPDATE learning_logs SET clarity = 3, alignment = 3
--       WHERE schema_version = 'v2';

ALTER TABLE learning_logs
  ALTER COLUMN clarity DROP NOT NULL,
  ALTER COLUMN alignment DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS stuck_tried TEXT,
  ADD COLUMN IF NOT EXISTS hours_bucket TEXT,
  ADD COLUMN IF NOT EXISTS collab_rating SMALLINT
    CHECK (collab_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS progress_rating SMALLINT
    CHECK (progress_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS contribution TEXT,
  ADD COLUMN IF NOT EXISTS learned TEXT,
  ADD COLUMN IF NOT EXISTS capability_rating SMALLINT
    CHECK (capability_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS energy_rating SMALLINT
    CHECK (energy_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS feeling_word VARCHAR(50),
  ADD COLUMN IF NOT EXISTS recognition TEXT;

-- RLS: 00040's policies are row-scoped (self + cycle staff), so the new
-- columns are covered with no policy change.
