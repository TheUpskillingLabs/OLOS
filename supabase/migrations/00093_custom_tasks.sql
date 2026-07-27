-- Admin-authored member tasks (task-management consolidation, phase 2).
--
-- Until now every task in the member queue was DERIVED (windows from
-- cycle_config, the gate from log_due_at, …) — pushing an ad-hoc ask like
-- "RSVP for the Summit by Friday" onto members' dashboards required a code
-- change. custom_tasks is the authored task source: admins create rows in
-- /admin/tasks; the assembler (lib/tasks/assemble.ts) merges them into the
-- queue as kind='custom' with instanceKey `custom:{id}`, so the existing
-- dismissal machinery (task_dismissals, 00092) applies unchanged. A
-- re-announcement is a NEW row (new id → fresh dismissal state), never an
-- un-archive.
--
-- Audience (v1): program-global (cycle_id NULL) or scoped to one cycle's
-- engaged members. starts_at/ends_at bound visibility; ends_at doubles as
-- the displayed deadline. Retire via archived_at — rows are never deleted
-- (dismissals reference their ids).

CREATE TABLE custom_tasks (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  detail      TEXT,
  href        TEXT NOT NULL,
  cta         TEXT,
  cycle_id    INT REFERENCES cycles(id) ON DELETE CASCADE,
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  -- Pinned tasks sort into the reserved high band right under the weekly
  -- gate (lib/tasks/definitions.ts PRIORITY.pinned) and read as teal.
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  dismissible BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  INT REFERENCES participants(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX idx_custom_tasks_live ON custom_tasks (cycle_id) WHERE archived_at IS NULL;

ALTER TABLE custom_tasks ENABLE ROW LEVEL SECURITY;

-- SELECT: any member (the rows render on every member dashboard anyway).
CREATE POLICY "custom_tasks_select" ON custom_tasks FOR SELECT TO authenticated
  USING (true);

-- Writes: admin/owner only.
CREATE POLICY "custom_tasks_insert" ON custom_tasks FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_owner());
CREATE POLICY "custom_tasks_update" ON custom_tasks FOR UPDATE TO authenticated
  USING (is_admin_or_owner())
  WITH CHECK (is_admin_or_owner());

-- DOWN (manual rollback — forward-only repo policy):
-- DROP POLICY IF EXISTS "custom_tasks_update" ON custom_tasks;
-- DROP POLICY IF EXISTS "custom_tasks_insert" ON custom_tasks;
-- DROP POLICY IF EXISTS "custom_tasks_select" ON custom_tasks;
-- DROP TABLE IF EXISTS custom_tasks;
