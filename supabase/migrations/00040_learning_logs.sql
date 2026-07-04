-- 00040_learning_logs.sql
--
-- The Learning Log pivot (roadmap Phase 1; backend doc §6; prototype:
-- "replaces the Practice Journal, and the Pulse before it"). Pulse history
-- stays untouched — pulses were authored under a private contract and are
-- never backfilled into any feed. New cycles write here.
--
-- Shape follows the prototype's three-part ritual:
--   1. Health check (private to the member + their Poderator + admins):
--      clarity / alignment 1-5 + an "I'm blocked" toggle with the member's
--      own words. The metrics NEVER travel with a share.
--   2. Scaffolded reflection: three prompts (accomplished / exploring /
--      next_focus).
--   3. Optional share: share_publicly=true writes a profile_updates row
--      carrying ONLY the concatenated paragraph (provenance kept via
--      learning_log_id) — the sole source of member updates (no composer,
--      owner decision).
--
-- No per-day/week unique constraint: "log as often as you like" is intent —
-- the weekly gate needs at least one log per window, not exactly one.
-- kind carries the wk-7/13 milestone variants (prefilled evaluations,
-- never grades) so evaluations live beside weekly logs, cross-cycle
-- queryable (Pod Squad memo ask).
--
-- The weekly gate is config-as-data on cycle_config: the Friday cron arms
-- log_due_at; a member with an active enrollment and no log at/after it is
-- locked to the dashboard until they save one. log_gate_paused is the admin
-- grace/holiday toggle the prototype's Testing Controls model.
--
-- DOWN: DROP TABLE profile_updates; DROP TABLE learning_logs;
--       ALTER TABLE cycle_config DROP COLUMN log_due_at, DROP COLUMN log_gate_paused;

CREATE TABLE IF NOT EXISTS learning_logs (
  id SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id),
  cycle_id INT REFERENCES cycles(id), -- NULL = standalone reflection (the 00004 precedent)
  kind VARCHAR(20) NOT NULL DEFAULT 'weekly'
    CHECK (kind IN ('weekly', 'milestone_7', 'milestone_13')),
  clarity SMALLINT NOT NULL CHECK (clarity BETWEEN 1 AND 5),
  alignment SMALLINT NOT NULL CHECK (alignment BETWEEN 1 AND 5),
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  blocker_context TEXT,
  accomplished TEXT,
  exploring TEXT,
  next_focus TEXT,
  share_publicly BOOLEAN NOT NULL DEFAULT FALSE,
  schema_version VARCHAR(10) NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_logs_participant_created
  ON learning_logs(participant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_logs_cycle ON learning_logs(cycle_id);

CREATE TABLE IF NOT EXISTS profile_updates (
  id SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id),
  learning_log_id INT REFERENCES learning_logs(id), -- provenance: which log was shared
  body TEXT NOT NULL,
  visibility VARCHAR(20) NOT NULL DEFAULT 'labs' CHECK (visibility IN ('labs')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_updates_participant
  ON profile_updates(participant_id, created_at DESC);

ALTER TABLE cycle_config ADD COLUMN IF NOT EXISTS log_due_at TIMESTAMPTZ;
ALTER TABLE cycle_config ADD COLUMN IF NOT EXISTS log_gate_paused BOOLEAN NOT NULL DEFAULT FALSE;

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Same posture as pulse_checks: self + cycle-staff read, self insert,
-- append-only (no UPDATE/DELETE policies). Poderator pod-scoped reads go
-- through service-role routes, exactly like the pulse dashboards.
-- can_write_cycles() is 00037's honestly-named helper (owner/admin/dev).

ALTER TABLE learning_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learning_logs_select ON learning_logs;
CREATE POLICY learning_logs_select ON learning_logs FOR SELECT
  USING (participant_id = current_participant_id() OR can_write_cycles());

DROP POLICY IF EXISTS learning_logs_insert ON learning_logs;
CREATE POLICY learning_logs_insert ON learning_logs FOR INSERT
  WITH CHECK (participant_id = current_participant_id());

ALTER TABLE profile_updates ENABLE ROW LEVEL SECURITY;

-- Members-only feed: any signed-in member reads 'labs'-visibility updates.
-- The share paragraph is self-authored public-to-members content — the
-- health metrics live only on learning_logs and never join this table.
DROP POLICY IF EXISTS profile_updates_select ON profile_updates;
CREATE POLICY profile_updates_select ON profile_updates FOR SELECT
  TO authenticated
  USING (visibility = 'labs');

-- Owner may retract a share (the prototype's deleteUpdate owner control).
DROP POLICY IF EXISTS profile_updates_delete ON profile_updates;
CREATE POLICY profile_updates_delete ON profile_updates FOR DELETE
  USING (participant_id = current_participant_id());
