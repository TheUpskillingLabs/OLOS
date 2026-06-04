-- PRD: docs/PRD-moderator-dashboard.md §7.7, §7.8, §9
-- Subdoc: docs/poderator-dashboard/CLAUDE.md (New DB tables)
--
-- Per-poderator UI state that persists across sessions:
--   - last_view: switcher selection ('all_pods' | a specific pod_id as text)
--   - roster_filters: filter (status, search) and any future roster filter knobs
--   - roster_sort: column key used for the per-pod member roster
--   - tooltip_seen: tooltip keys auto-suppressed after 1-2 encounters
--
-- One row per poderator (participant_id is the primary key). Admins
-- receive rows too (see PRD §10 — "Admin ui-state").

CREATE TABLE moderator_ui_state (
  participant_id  INT PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
  last_view       TEXT,
  roster_filters  JSONB NOT NULL DEFAULT '{}'::jsonb,
  roster_sort     TEXT,
  tooltip_seen    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE moderator_ui_state ENABLE ROW LEVEL SECURITY;

-- SELECT/INSERT/UPDATE: own row, or admin/owner
CREATE POLICY "moderator_ui_state_select" ON moderator_ui_state FOR SELECT TO authenticated
  USING (
    participant_id = current_participant_id()
    OR is_admin_or_owner()
  );

CREATE POLICY "moderator_ui_state_insert" ON moderator_ui_state FOR INSERT TO authenticated
  WITH CHECK (
    participant_id = current_participant_id()
    OR is_admin_or_owner()
  );

CREATE POLICY "moderator_ui_state_update" ON moderator_ui_state FOR UPDATE TO authenticated
  USING (
    participant_id = current_participant_id()
    OR is_admin_or_owner()
  )
  WITH CHECK (
    participant_id = current_participant_id()
    OR is_admin_or_owner()
  );

-- DOWN (manual rollback — forward-only repo policy):
-- DROP POLICY IF EXISTS "moderator_ui_state_update" ON moderator_ui_state;
-- DROP POLICY IF EXISTS "moderator_ui_state_insert" ON moderator_ui_state;
-- DROP POLICY IF EXISTS "moderator_ui_state_select" ON moderator_ui_state;
-- DROP TABLE IF EXISTS moderator_ui_state;
