-- =============================================================================
-- Prod migration-history repair #2 — 2026-07-06
-- =============================================================================
--
-- Run ONCE against the prod Supabase project via Studio SQL Editor.
-- Idempotent — safe to re-run.
--
-- DIAGNOSIS (2026-07-06, from prod's schema_migrations + information_schema):
--   - Numeric rows tracked: 00001..00015 only.
--   - 17 timestamp-versioned rows (20260521..20260703) map BY NAME, 1:1, to
--     the on-disk files 00016..00032 — the DDL is applied, the bookkeeping
--     just uses CLI-generated timestamp versions the numeric files can't match.
--   - Table inventory confirms the schema is exactly at 00032: cycle_agreements
--     present; nothing from 00033+ (no events/resources/metros/learning_logs/
--     sectors/saved_items/spotlights/field_surveys/testers).
--   - The 2026-06-02 repair script was written but NEVER RUN (its aliases are
--     absent). This script supersedes it — delete that file after this runs.
--
-- WHAT THIS DOES
--   Section 1 — Insert numeric tracking rows 00016..00032 so `supabase db push`
--               recognizes those files as applied. No DDL — it's all present.
--   Section 2 — Sanity check to eyeball.
--
-- The timestamp rows are left in place (the CLI matches by version; extra
-- remote-only rows are harmless noise in `migration list`).
--
-- AFTER THIS RUNS
--   `supabase db push` against prod will apply 00033..00058 — the dev-tested
--   catch-up (public content, learning logs, metros, sector model, …) plus the
--   onboarding migrations. Do it with --dry-run first, and note the two
--   data-dependent watchpoints:
--     * 00048 enforces ≤1 active cycle (fails if prod data violates it — check:
--       SELECT COUNT(*) FROM cycles WHERE status='active';)
--     * 00056 extends the enrollment-status CHECK — verify coverage:
--       SELECT DISTINCT status FROM cycle_enrollments;
--   Hold 00058 until its two flagged legal decisions are signed off.
--
-- =============================================================================
-- Section 1 — numeric aliases for the applied-but-timestamp-tracked migrations
-- =============================================================================

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES
  ('00016', 'short_form_registration'),
  ('00017', 'add_nominations_if_missing'),
  ('00018', 'solution_proposals_rich_fields'),
  ('00019', 'solution_proposals_update_policy'),
  ('00020', 'participants_select_shared_pod'),
  ('00021', 'participants_update_with_check'),
  ('00022', 'pod_memberships_select_hide_soft_deleted'),
  ('00023', 'nudge_dismissals'),
  ('00024', 'moderator_ui_state'),
  ('00025', 'participants_ai_experience'),
  ('00026', 'cycle_config_extensions'),
  ('00027', 'moderator_ui_state_last_pod_tab'),
  ('00028', 'pod_memberships_preference_rank'),
  ('00029', 'feedback'),
  ('00030', 'revocation_warnings_and_idempotency'),
  ('00031', 'funnel_registration_fields'),
  ('00032', 'cycle_agreements')
ON CONFLICT (version) DO NOTHING;

-- =============================================================================
-- Section 2 — sanity check (expect 32 numeric rows, 00001..00032, plus the
-- 17 timestamp rows)
-- =============================================================================

SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;
