-- Renumbered from 00015 → 00028 on 2026-06-02. The original filename
-- collided with 00015_grant_role_privileges.sql, which broke
-- `supabase db push --include-all` (schema_migrations.version is a PK).
-- The DDL below is idempotent (`ADD COLUMN IF NOT EXISTS`); on any
-- environment where the original 00015 file had already been applied,
-- this file is a no-op on the schema. The schema_migrations.version
-- row is what changes — see the renumber entry in supabase/CLAUDE.md
-- for the repair SQL.
--
-- ROADMAP §1.4 / ISSUE-W1-004 / D1 (resolved: preserve)
-- Add preference_rank to pod_memberships so the legacy migration script can
-- write Seat 1 / Seat 2 / Seat 3 form responses with their original rank
-- preserved, rather than flattening them to a bag of (participant, pod).
--
-- D1 background (docs/OLOS-roadmap.md §5 Open Decisions): the legacy Pod
-- Registration form collected three ranked seat preferences per participant.
-- The current pod_memberships table models a bag — "this participant is in
-- this pod" — with no slot for rank. Flattening would discard signal that
-- downstream pod-finalization may want to use. Preserving costs one SMALLINT.
--
-- Semantic note for application code: until §2.x finalization logic ships,
-- pod_memberships becomes dual-purpose. Three rows per legacy participant
-- (one per filled seat, in different pods) each represent a *preference
-- declaration*, not three concurrent memberships. UNIQUE(participant_id,
-- pod_id) still holds — a participant can rank a given pod at most once.
-- Future finalization will set inactive_at on the unselected preferences.
-- Flagging here so a reader of pod_memberships doesn't assume rank IS NULL
-- means "real member" — it means "joined directly, no rank captured" (the
-- pre-W1-004 invariant for cycle_id=1 Spring 2026 Build Cycle rows).
--
-- NULL allowed for historical rows from cycle_id=1. The 19 existing
-- memberships predate this column and have no rank to backfill. Setting
-- NOT NULL with a synthetic default would lie. Application code that wants
-- "preference rows only" should filter `WHERE preference_rank IS NOT NULL`.
--
-- CHECK constraint pins to 1..3 — the legacy form had exactly three seats.
-- If a future form ships with N seats, this becomes a forward migration to
-- widen the check, not a NULLable escape hatch.

ALTER TABLE pod_memberships
  ADD COLUMN IF NOT EXISTS preference_rank SMALLINT
    CHECK (preference_rank IS NULL OR preference_rank BETWEEN 1 AND 3);

COMMENT ON COLUMN pod_memberships.preference_rank IS
  'Legacy Seat 1/2/3 rank from spreadsheet migration (1=top choice). NULL = joined directly without ranked-choice flow. See migration 00015 header.';

-- DOWN: rollback block. Copy into a scratch query to revert in dev.
-- Not auto-applied; Supabase migrations are forward-only. A real rollback
-- ships as a new forward migration so the history stays linear.
--
-- ALTER TABLE pod_memberships
--   DROP COLUMN IF EXISTS preference_rank;
