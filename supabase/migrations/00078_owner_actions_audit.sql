-- 00078_owner_actions_audit.sql — owner lifecycle management (delete/archive/reset)
--
-- WHY: owners are gaining a governed surface to delete/archive/reset any major
-- entity (participants first; cycles/pods/projects/metros in later phases). Every
-- such action is destructive or state-changing, so each one writes a durable,
-- owner-only-readable audit row here. This is the general operational log; the
-- GDPR-specific `participant_erasures` tombstone (00058) stays as-is and is
-- written alongside this table by delete_participant.
--
-- The destructive RPCs (delete_participant, reset_*) insert their row inside the
-- same transaction via auth.uid() (owner-only, SECURITY DEFINER — see 00079);
-- the reversible archive path inserts from the API layer via the service client.

CREATE TABLE IF NOT EXISTS owner_actions (
  id                   bigserial PRIMARY KEY,
  actor_participant_id integer,             -- owner's participant id (not FK — may outlive them)
  actor_email          varchar,             -- denormalized snapshot of the acting owner
  entity_type          varchar NOT NULL,    -- 'participants','cycles','pods','projects','metros',…
  entity_id            varchar NOT NULL,    -- text so it accommodates int + any future uuid keys
  entity_label         varchar,             -- denormalized display snapshot (e.g. email/name)
  action               varchar NOT NULL CHECK (action IN ('archive','reset','delete')),
  reason               varchar,
  detail               jsonb,               -- action-specific counts, e.g. {"rolesRevoked":2}
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_actions_entity
  ON owner_actions (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_owner_actions_created
  ON owner_actions (created_at DESC);

-- Owner-only read. No INSERT/UPDATE/DELETE policy: every write goes through a
-- SECURITY DEFINER RPC or the service-role client, both of which bypass RLS —
-- so with RLS enabled and no write policy, no authenticated/anon client can
-- forge or tamper with an audit row directly.
ALTER TABLE owner_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_actions_owner_read ON owner_actions FOR SELECT USING (is_owner());

-- DOWN:
-- DROP TABLE IF EXISTS owner_actions;
