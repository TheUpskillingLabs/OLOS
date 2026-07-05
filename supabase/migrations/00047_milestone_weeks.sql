-- 00047_milestone_weeks.sql
-- The wk-mid/final milestone Learning-Log evaluations fire on admin-configurable
-- weeks, not hardcoded constants (owner: "everything configurable in the admin
-- panel"; finishes Phase 1 — the milestone_7/milestone_13 log kinds from 00040).
-- The two weeks default to 6 (mid-cycle) and 12 (final/Showcase) on the
-- wk0-Kickoff → wk12-Showcase calendar. Legacy note: the kind labels say 7/13
-- from the old 13-week model; the weeks are what actually drive timing, hence
-- config here. Read by app/api/learning-logs (which kind to write) + the member
-- card + the Poderator milestone card.
--
-- Idempotent + re-runnable. Existing rows inherit the DEFAULTs.
--
-- DOWN:
--   ALTER TABLE cycle_config DROP CONSTRAINT IF EXISTS cycle_config_milestone_weeks_range;
--   ALTER TABLE cycle_config DROP COLUMN IF EXISTS milestone_mid_week, DROP COLUMN IF EXISTS milestone_final_week;

ALTER TABLE cycle_config
  ADD COLUMN IF NOT EXISTS milestone_mid_week   SMALLINT NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS milestone_final_week SMALLINT NOT NULL DEFAULT 12;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cycle_config_milestone_weeks_range'
  ) THEN
    ALTER TABLE cycle_config
      ADD CONSTRAINT cycle_config_milestone_weeks_range
      CHECK (milestone_mid_week BETWEEN 0 AND 12 AND milestone_final_week BETWEEN 0 AND 12);
  END IF;
END $$;

COMMENT ON COLUMN cycle_config.milestone_mid_week IS
  'Cycle week (0-12) the mid-cycle milestone evaluation (learning_logs.kind=milestone_7) opens. Admin-editable; default 6.';
COMMENT ON COLUMN cycle_config.milestone_final_week IS
  'Cycle week (0-12) the final milestone evaluation (learning_logs.kind=milestone_13) opens. Admin-editable; default 12.';
