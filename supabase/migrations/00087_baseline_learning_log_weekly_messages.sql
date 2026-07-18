-- 00087_baseline_learning_log_weekly_messages.sql
--
-- Two additions around the Learning Log ritual (00040):
--
--   1. A one-time BASELINE measurement per participant per cycle. It rides
--      the existing learning_logs gate as a new kind='baseline' variant (so
--      the Week-0 baseline satisfies the weekly gate like any other log),
--      but its eight structured answers land in a dedicated baseline_responses
--      row rather than the free-text reflection columns. The eight questions
--      are a fixed instrument (adapted in part from Chen et al. 2015 BPNSF for
--      the autonomy item) — they are deliberately HARDCODED in
--      lib/learning-logs/baseline.ts, NOT admin-configurable, so the measure
--      stays comparable across cycles. schema_version pins the instrument
--      version a row was answered under.
--
--   2. cycle_weekly_messages — the admin-authored per-week "What's next"
--      message shown to a participant right after they save that week's
--      learning log. One row per (cycle, week); admin-writable, all-read,
--      following the 00086 cycle_phases/cycle_events RLS pattern exactly.
--
-- baseline_responses mirrors learning_logs' RLS posture (00040): self +
-- cycle-staff SELECT, self INSERT, append-only (no UPDATE/DELETE) — a baseline
-- is measured once and never edited.
--
-- Idempotent: CHECK swap via a name-lookup DO block; CREATE IF NOT EXISTS;
-- DROP POLICY IF EXISTS before CREATE.
--
-- DOWN:
--   DROP TABLE IF EXISTS cycle_weekly_messages;
--   DROP TABLE IF EXISTS baseline_responses;
--   ALTER TABLE learning_logs DROP CONSTRAINT IF EXISTS learning_logs_kind_check;
--   ALTER TABLE learning_logs ADD CONSTRAINT learning_logs_kind_check
--     CHECK (kind IN ('weekly', 'milestone_7', 'milestone_13'));

-- ── 1. Extend learning_logs.kind to include 'baseline' ───────────────────
-- The CHECK was created inline in 00040, so its default name is
-- learning_logs_kind_check — but look it up from pg_constraint rather than
-- assume, in case the inline default ever differed.

DO $$
DECLARE
  c_name text;
BEGIN
  SELECT con.conname INTO c_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'learning_logs'
    AND rel.relnamespace = 'public'::regnamespace
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%kind%'
  LIMIT 1;

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE learning_logs DROP CONSTRAINT %I', c_name);
  END IF;
END $$;

ALTER TABLE learning_logs
  ADD CONSTRAINT learning_logs_kind_check
  CHECK (kind IN ('weekly', 'milestone_7', 'milestone_13', 'baseline'));

-- ── 2. baseline_responses ────────────────────────────────────────────────
-- One row per participant per cycle. learning_log_id ties the baseline to the
-- learning_logs row that opened it (UNIQUE = at most one baseline per log).
-- The two _outlook columns are free text; the six SMALLINTs are 1–5 scales.

CREATE TABLE IF NOT EXISTS baseline_responses (
  id                  SERIAL PRIMARY KEY,
  learning_log_id     INT NOT NULL UNIQUE REFERENCES learning_logs(id),
  participant_id      INT NOT NULL REFERENCES participants(id),
  cycle_id            INT NOT NULL REFERENCES cycles(id),
  ai_usage_frequency  SMALLINT NOT NULL CHECK (ai_usage_frequency BETWEEN 1 AND 5),   -- 1=Not at all … 5=Daily or more
  work_shift_outlook  TEXT,   -- "How do you see AI shifting the nature of work in the next 5 years?"
  role_change_outlook TEXT,   -- "How do you see your own role in work changing…?"
  skills_readiness    SMALLINT NOT NULL CHECK (skills_readiness BETWEEN 1 AND 5),
  learning_confidence SMALLINT NOT NULL CHECK (learning_confidence BETWEEN 1 AND 5),
  judgment_confidence SMALLINT NOT NULL CHECK (judgment_confidence BETWEEN 1 AND 5),
  autonomy            SMALLINT NOT NULL CHECK (autonomy BETWEEN 1 AND 5),             -- adapted from Chen et al. 2015 (BPNSF)
  peer_investment     SMALLINT NOT NULL CHECK (peer_investment BETWEEN 1 AND 5),
  schema_version      VARCHAR(10) NOT NULL DEFAULT 'v1',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (participant_id, cycle_id)
);

CREATE INDEX IF NOT EXISTS idx_baseline_responses_cycle ON baseline_responses (cycle_id);

-- RLS: same posture as learning_logs (00040). can_write_cycles() is 00037's
-- honestly-named owner/admin/dev helper. Append-only — no UPDATE/DELETE.
ALTER TABLE baseline_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS baseline_responses_select ON baseline_responses;
CREATE POLICY baseline_responses_select ON baseline_responses FOR SELECT
  USING (participant_id = current_participant_id() OR can_write_cycles());

DROP POLICY IF EXISTS baseline_responses_insert ON baseline_responses;
CREATE POLICY baseline_responses_insert ON baseline_responses FOR INSERT
  WITH CHECK (participant_id = current_participant_id());

-- ── 3. cycle_weekly_messages ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cycle_weekly_messages (
  id         SERIAL PRIMARY KEY,
  cycle_id   INT NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  week       SMALLINT NOT NULL CHECK (week BETWEEN 0 AND 12),
  message    TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, week)
);

ALTER TABLE cycle_weekly_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cycle_weekly_messages_select ON cycle_weekly_messages;
CREATE POLICY cycle_weekly_messages_select ON cycle_weekly_messages
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS cycle_weekly_messages_write ON cycle_weekly_messages;
CREATE POLICY cycle_weekly_messages_write ON cycle_weekly_messages
  FOR ALL TO authenticated USING (is_admin_or_owner());
