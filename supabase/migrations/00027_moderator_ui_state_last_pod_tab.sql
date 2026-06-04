-- PRD: docs/PRD-moderator-dashboard.md §7.7 (per-poderator UI state)
-- Subdoc: docs/poderator-dashboard/CLAUDE.md (New DB tables → moderator_ui_state)
--
-- Adds the Per-pod page's active tab (Members vs Recent pulses) to the
-- per-poderator UI state row. Persisting this lets a poderator return to
-- the tab they last used on a given pod across sessions.
--
-- Values: 'members' | 'recent_pulses'. Default NULL → client renders
-- 'members' (the existing behavior, so legacy rows degrade gracefully).

ALTER TABLE moderator_ui_state
  ADD COLUMN IF NOT EXISTS last_pod_tab TEXT;

-- DOWN (manual rollback — forward-only repo policy):
-- ALTER TABLE moderator_ui_state DROP COLUMN IF EXISTS last_pod_tab;
