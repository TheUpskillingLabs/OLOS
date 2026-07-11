-- =============================================================================
-- DEV migration-history repair — 2026-07-06
-- =============================================================================
--
-- Run ONCE against the DEV Supabase project via Studio SQL Editor.
-- Idempotent — safe to re-run.
--
-- DIAGNOSIS (2026-07-06, from dev's schema_migrations):
--   - Numeric rows tracked: 00001..00029.
--   - 25 timestamp-versioned rows; 24 map BY NAME, 1:1, onto the on-disk files
--     00030..00053 (applied, just tracked under CLI-generated timestamps).
--   - The 25th — 20260703230842 fix_miami_partner_null — is a one-off data fix
--     with no local file. Its work is done; no alias needed.
--   - Schema is therefore exactly at 00053. Nothing missing, nothing extra.
--
-- STEP 1 — run this script (numeric aliases 00030..00053):

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES
  ('00030', 'revocation_warnings_and_idempotency'),
  ('00031', 'funnel_registration_fields'),
  ('00032', 'cycle_agreements'),
  ('00033', 'public_content'),
  ('00034', 'seed_public_content'),
  ('00035', 'luma_sync'),
  ('00036', 'retire_placeholder_resources'),
  ('00037', 'schema_hardening'),
  ('00038', 'metros_source_of_truth'),
  ('00039', 'event_rsvps_hardening'),
  ('00040', 'learning_logs'),
  ('00041', 'participants_staff_test_flags'),
  ('00042', 'testers'),
  ('00043', 'pod_limit'),
  ('00044', 'directory_columns'),
  ('00045', 'ensure_profile_image_url'),
  ('00046', 'avatars_bucket'),
  ('00047', 'milestone_weeks'),
  ('00048', 'single_active_cycle'),
  ('00049', 'sector_model_phase_a'),
  ('00050', 'saved_items'),
  ('00051', 'spotlights'),
  ('00052', 'spotlight_image'),
  ('00053', 'field_survey_intake')
ON CONFLICT (version) DO NOTHING;

-- sanity: expect an unbroken 00001..00053 plus the soon-to-be-reverted timestamps
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;

-- STEP 2 — from the OLOS repo, linked to DEV, clear the timestamp claims
-- (bookkeeping only — marks the rows reverted, changes NO schema or data;
-- the numeric aliases from Step 1 carry the applied-state from here on):
--
--   supabase migration repair --status reverted \
--     20260603213715 20260703222226 20260703222343 20260703230259 \
--     20260703230813 20260703230842 20260703235238 20260704003519 \
--     20260704164700 20260704164711 20260704164720 20260704190507 \
--     20260704190516 20260704191714 20260704213645 20260705011130 \
--     20260705015939 20260705022330 20260705033456 20260705143133 \
--     20260705144504 20260705155136 20260705170819 20260706023514 \
--     20260706064350
--
-- STEP 3 — verify, then push the onboarding migrations:
--
--   supabase migration list          # remote: clean 00001..00053
--   supabase db push --dry-run       # expect exactly 00054..00058
--   supabase db push
-- =============================================================================
