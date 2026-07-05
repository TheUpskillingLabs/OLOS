-- 00045_ensure_profile_image_url.sql
--
-- Reconcile a schema drift. `00003_add_profile_image_url.sql` is recorded as
-- applied in supabase_migrations.schema_migrations, but on OLOS-dev the column
-- is absent (information_schema confirms it does not exist). No migration ever
-- drops it — the dev database simply lost the column while keeping the applied
-- record. supabase/CLAUDE.md: "the roadmap is the plan; migrations/ is the
-- truth. They drift."
--
-- Symptom this fixes: the community directory reads (/directory, /u/[handle],
-- the profile_updates feed) SELECT participants.profile_image_url by name, so
-- PostgREST rejects the whole query with 400 wherever the column is missing —
-- rendering the directory empty and 404-ing visitor profiles. (/profile dodged
-- it only because it uses select("*").)
--
-- Idempotent: ADD COLUMN IF NOT EXISTS is a no-op anywhere 00003 actually took
-- (e.g. prod), and restores the column where it drifted away. The DDL triggers
-- Supabase's PostgREST schema-cache reload, so the 400s clear immediately.
--
-- No -- DOWN: block — this only guarantees a column 00003 already intended.

ALTER TABLE participants ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

COMMENT ON COLUMN participants.profile_image_url IS
  'Member avatar URL (originally 00003). Re-ensured in 00045 after dev drift. '
  'Null for funnel signups today — Google OAuth avatars live in auth user-metadata; '
  'directory cards fall back to initials.';
