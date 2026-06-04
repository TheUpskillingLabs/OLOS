-- PRD: docs/PRD-moderator-dashboard.md §7.3.1 (Member preview shape)
-- Subdoc: docs/poderator-dashboard/CLAUDE.md (participants extension)
--
-- Adds the structured member-preview fields used by the per-pod roster
-- (§7.3), the All pods nudge cards (§7.2), and the pulse review panel
-- header (§7.4). One canonical shape, captured at registration.
--
-- `ai_experience_level` is an enum so it is sortable/filterable in the
-- roster without UI-label lookups. UI labels for each value live in
-- application code (program-team-owned copy).
--
-- Legacy rows default to 'new'. The registration form is updated
-- separately (program-team-owned copy + form change).

CREATE TYPE ai_experience_level AS ENUM ('new', 'consumer', 'builder', 'shipper');

ALTER TABLE participants
  ADD COLUMN ai_experience_level ai_experience_level NOT NULL DEFAULT 'new',
  ADD COLUMN availability_snippet TEXT;

-- No new RLS needed: participants policies (00002 + 00020) already cover
-- visibility — own row + cross-pod-mate via the participants_select_visible
-- predicate, plus admin/owner.

-- DOWN (manual rollback — forward-only repo policy):
-- ALTER TABLE participants
--   DROP COLUMN IF EXISTS availability_snippet,
--   DROP COLUMN IF EXISTS ai_experience_level;
-- DROP TYPE IF EXISTS ai_experience_level;
