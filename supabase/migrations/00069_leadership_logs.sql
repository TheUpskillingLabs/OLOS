-- 00069_leadership_logs.sql
--
-- The Leadership Log (docs/ORG_CYCLES.md, docs/LOCAL_LABS.md): a weekly
-- team-reflection CASCADE for the org tiers, mirroring the Learning Log
-- (00040). Within a mode='org' cycle each tier reflects in the context of the
-- tier below, staggered by day:
--   • workstream team members — Wednesday (their existing Learning Log, now
--     armed Wed for org cycles and EXTENDED with work fields below)
--   • workstream leads        — Thursday (read their members' logs)
--   • Lab Leads               — Friday   (read their workstream leads' logs)
--
-- Two schema moves:
--   1. Extend learning_logs with three WORK fields (owner: "make org members
--      both a learning log + work log fields"). Nullable — only org-cycle logs
--      populate them; participant logs leave them NULL. No gate/RLS change.
--   2. New leadership_logs table for the LEAD tiers only (member tier stays in
--      learning_logs). Non-blocking — no gate lock; the dashboard surfaces a
--      due card + a reminder cron. Scope key is (tier, cycle_id, pod_id|lab_id):
--      workstream_lead ⇒ a run pod, lab_lead ⇒ a lab (metros id).
--
-- The weekly leadership window is config-as-data like the Learning Log: a
-- Wednesday cron arms cycle_config.leadership_log_due_at; per-tier target days
-- are derived offsets (ws-lead +1, lab-lead +2). leadership_log_gate_paused is
-- the admin grace toggle. RLS mirrors 00040 (self + can_write_cycles read, self
-- insert, append-only); cross-tier lead reads go through service-role routes.
--
-- Idempotent + re-runnable.
--
-- DOWN:
--   DROP TABLE IF EXISTS leadership_logs;
--   ALTER TABLE cycle_config
--     DROP COLUMN IF EXISTS leadership_log_due_at,
--     DROP COLUMN IF EXISTS leadership_log_gate_paused;
--   ALTER TABLE learning_logs
--     DROP COLUMN IF EXISTS work_summary,
--     DROP COLUMN IF EXISTS work_progress,
--     DROP COLUMN IF EXISTS work_blockers;

-- ── 1. Work fields on the member Learning Log ───────────────────────────────
ALTER TABLE learning_logs ADD COLUMN IF NOT EXISTS work_summary TEXT;
ALTER TABLE learning_logs ADD COLUMN IF NOT EXISTS work_progress TEXT;
ALTER TABLE learning_logs ADD COLUMN IF NOT EXISTS work_blockers TEXT;

-- ── 2. The leadership log (lead tiers only) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS leadership_logs (
  id SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id),
  cycle_id INT NOT NULL REFERENCES cycles(id),
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('workstream_lead', 'lab_lead')),
  pod_id INT REFERENCES pods(id),       -- set for workstream_lead
  lab_id INT REFERENCES metros(id),     -- set for lab_lead
  clarity SMALLINT NOT NULL CHECK (clarity BETWEEN 1 AND 5),
  alignment SMALLINT NOT NULL CHECK (alignment BETWEEN 1 AND 5),
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  blocker_context TEXT,
  accomplished TEXT,
  exploring TEXT,
  next_focus TEXT,
  schema_version VARCHAR(10) NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- exactly one scope, mirroring workstreams_one_home_check (00062)
  CONSTRAINT leadership_logs_one_scope CHECK (
    (tier = 'workstream_lead' AND pod_id IS NOT NULL AND lab_id IS NULL) OR
    (tier = 'lab_lead' AND lab_id IS NOT NULL AND pod_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_leadership_logs_participant_created
  ON leadership_logs(participant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leadership_logs_cycle_tier
  ON leadership_logs(cycle_id, tier, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leadership_logs_pod
  ON leadership_logs(pod_id) WHERE pod_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leadership_logs_lab
  ON leadership_logs(lab_id) WHERE lab_id IS NOT NULL;

-- ── 3. Weekly window config (mirrors 00040's log_due_at/log_gate_paused) ─────
ALTER TABLE cycle_config ADD COLUMN IF NOT EXISTS leadership_log_due_at TIMESTAMPTZ;
ALTER TABLE cycle_config ADD COLUMN IF NOT EXISTS leadership_log_gate_paused BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 4. RLS — same posture as learning_logs (00040) ──────────────────────────
-- Self + cycle-staff (can_write_cycles = owner/admin/dev) read; self insert;
-- append-only. A lead's read of their team-below's logs goes through a
-- service-role route, not an RLS predicate (avoids recursive policies over
-- moderator_assignments/lab_leads).
ALTER TABLE leadership_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leadership_logs_select ON leadership_logs;
CREATE POLICY leadership_logs_select ON leadership_logs FOR SELECT
  USING (participant_id = current_participant_id() OR can_write_cycles());

DROP POLICY IF EXISTS leadership_logs_insert ON leadership_logs;
CREATE POLICY leadership_logs_insert ON leadership_logs FOR INSERT
  WITH CHECK (participant_id = current_participant_id());
