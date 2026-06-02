-- PRD: docs/PRD-moderator-dashboard.md §7.2 / §9
-- Subdoc: docs/poderator-dashboard/CLAUDE.md (New DB tables)
--
-- Records per-poderator dismissals of at-risk-member nudge instances.
-- A dismissed nudge stays dismissed across sessions for that poderator
-- (and only that poderator), but re-fires automatically when the
-- condition re-trips: re-fire is signaled by a new `nudge_key` value
-- (the key encodes occurrence; see lib/moderator/nudges.ts for the
-- canonical key shape).

CREATE TABLE nudge_dismissals (
  id                        SERIAL PRIMARY KEY,
  moderator_participant_id  INT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  pod_id                    INT NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  nudge_key                 TEXT NOT NULL,
  dismissed_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (moderator_participant_id, pod_id, nudge_key)
);

CREATE INDEX idx_nudge_dismissals_lookup ON nudge_dismissals (moderator_participant_id, pod_id);

ALTER TABLE nudge_dismissals ENABLE ROW LEVEL SECURITY;

-- SELECT: own dismissals, or admin/owner
CREATE POLICY "nudge_dismissals_select" ON nudge_dismissals FOR SELECT TO authenticated
  USING (
    moderator_participant_id = current_participant_id()
    OR is_admin_or_owner()
  );

-- INSERT: only as the dismissing poderator. Caller must also be an active
-- moderator of the pod the nudge belongs to (cannot dismiss nudges for pods
-- you don't moderate).
CREATE POLICY "nudge_dismissals_insert" ON nudge_dismissals FOR INSERT TO authenticated
  WITH CHECK (
    moderator_participant_id = current_participant_id()
    AND (
      is_admin_or_owner()
      OR EXISTS (
        SELECT 1
        FROM moderator_assignments ma
        WHERE ma.pod_id = nudge_dismissals.pod_id
          AND ma.participant_id = current_participant_id()
          AND ma.removed_at IS NULL
      )
    )
  );

-- DOWN (manual rollback — forward-only repo policy):
-- DROP POLICY IF EXISTS "nudge_dismissals_insert" ON nudge_dismissals;
-- DROP POLICY IF EXISTS "nudge_dismissals_select" ON nudge_dismissals;
-- DROP TABLE IF EXISTS nudge_dismissals;
