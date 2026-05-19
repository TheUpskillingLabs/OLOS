-- Grant standard Supabase role privileges on all public tables.
--
-- These grants are normally auto-applied by Supabase when tables are created
-- via the dashboard, but are not emitted by `supabase db push` from migrations.
-- Without them, the service_role cannot query tables (breaking the auth callback)
-- and RLS policies scoped to `authenticated` / `anon` have no effect.

-- service_role: full access, bypasses RLS (used by server-side service clients)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- authenticated: read/write access; RLS policies scope what rows are visible
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- anon: read-only access for public/pre-auth queries (e.g. option_lists on registration form)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Ensure future tables created by migrations get the same grants automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
