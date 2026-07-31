-- Central task system (task-management consolidation): per-member dismissals
-- of dismissible task instances on the member dashboard.
--
-- Modeled on 00023_nudge_dismissals: the key encodes the OCCURRENCE, so a
-- dismissal persists until the task recurs under a new key — e.g. dismissing
-- the "voting" window task in cycle 14 stores `window:voting:c14`; when
-- cycle 15 opens voting the task's key is `window:voting:c15`, no row
-- matches, and it shows again. lib/tasks/keys.ts is the canonical key
-- grammar. Replaces the localStorage stores (olos.dismissedTodos.v1 et al),
-- which were per-device and hid recurring tasks forever (bare ids carried no
-- occurrence).
--
-- Member-global (unlike nudge_dismissals' per-pod scoping): a member's task
-- queue is one list, so the unique key is (participant, task_key).

CREATE TABLE task_dismissals (
  id             SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  task_key       TEXT NOT NULL,
  dismissed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (participant_id, task_key)
);

CREATE INDEX idx_task_dismissals_participant ON task_dismissals (participant_id);

ALTER TABLE task_dismissals ENABLE ROW LEVEL SECURITY;

-- SELECT: own dismissals, or admin/owner (support/debug parity with 00023)
CREATE POLICY "task_dismissals_select" ON task_dismissals FOR SELECT TO authenticated
  USING (
    participant_id = current_participant_id()
    OR is_admin_or_owner()
  );

-- INSERT: only as yourself
CREATE POLICY "task_dismissals_insert" ON task_dismissals FOR INSERT TO authenticated
  WITH CHECK (participant_id = current_participant_id());

-- DELETE: only your own (un-dismiss)
CREATE POLICY "task_dismissals_delete" ON task_dismissals FOR DELETE TO authenticated
  USING (participant_id = current_participant_id());

-- DOWN (manual rollback — forward-only repo policy):
-- DROP POLICY IF EXISTS "task_dismissals_delete" ON task_dismissals;
-- DROP POLICY IF EXISTS "task_dismissals_insert" ON task_dismissals;
-- DROP POLICY IF EXISTS "task_dismissals_select" ON task_dismissals;
-- DROP TABLE IF EXISTS task_dismissals;
