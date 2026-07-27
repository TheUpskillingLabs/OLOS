-- 00092_simulation_sessions.sql
--
-- Audit trail for member-view simulation ("View as", lib/auth/simulation.ts):
-- an admin renders the member surfaces as a chosen participant, read-only, to
-- debug what that person actually sees.
--
-- The feature is deliberately narrow — read-only, never an admin target, and
-- owner-only against the prod database — but it is still one person looking at
-- the app through another person's account, so every session is recorded. This
-- table answers "who viewed whose dashboard, and when" without having to
-- reconstruct it from request logs.
--
-- Rows are written on start (POST /api/admin/simulate) and stamped with
-- ended_at on exit. A row with a NULL ended_at is either still running or was
-- abandoned when the cookie expired (1 hour) — the cookie, not this table, is
-- what authorizes a simulation, so an un-stamped row grants nothing.
--
-- Service-role only (RLS enabled, no policies), matching testers (00042):
-- written by the simulate routes, read by operators in Studio.
--
-- DOWN: DROP TABLE simulation_sessions;

CREATE TABLE IF NOT EXISTS simulation_sessions (
  id BIGSERIAL PRIMARY KEY,
  actor_participant_id INT REFERENCES participants(id),
  target_participant_id INT NOT NULL REFERENCES participants(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- "What has this admin been looking at?" — the question the table exists for.
CREATE INDEX IF NOT EXISTS idx_simulation_sessions_actor
  ON simulation_sessions (actor_participant_id, started_at DESC);

-- "Who has viewed this member's account?" — the subject-access side.
CREATE INDEX IF NOT EXISTS idx_simulation_sessions_target
  ON simulation_sessions (target_participant_id, started_at DESC);

ALTER TABLE simulation_sessions ENABLE ROW LEVEL SECURITY;
