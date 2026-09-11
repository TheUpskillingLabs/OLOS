-- 00102_participant_bans.sql — ban a person from the app, not just from a cycle.
--
-- WHY: the owner console had no ban. The two things that looked like one both
-- leave the door open:
--   * archive (00079 + lib/owner/archive.ts) revokes every role/enrollment/
--     membership and stamps archived_at, but the OAuth callback only asks
--     "is there a participants row for this email?" — so an archived person
--     still signs in, just with no roles.
--   * delete_participant (00058/00079) erases the participants + auth.users
--     rows, after which the /register funnel happily creates a fresh row for
--     the same Google account. That is a reset, not a ban.
--
-- So a ban needs its own state that OUTLIVES the participants row, keyed on
-- something the person carries between rows. Email is that key — the same
-- reasoning as `testers` (00042), whose email-keyed grant deliberately
-- survives a full reset.
--
-- Three enforcement points consume this table (see lib/auth/bans.ts):
--   1. app/api/auth/callback/route.ts — refuse the sign-in, sign the Supabase
--      session back out, redirect to /login?error=banned.
--   2. app/api/registrations/funnel/route.ts — refuse to create a participants
--      row, so the ban is not one /register away from being undone.
--   3. auth.users.banned_until, set by lib/owner/ban.ts — an independent second
--      layer inside GoTrue that refuses both new sign-ins and refresh-token
--      exchanges, so a live session dies at its next refresh.
-- Deliberately NOT enforced in proxy.ts: a DB round trip in the edge path on
-- every request is too expensive, and banned_until already covers live sessions.
--
-- WHAT A BAN CANNOT DO: a brand-new Google account on a different email walks
-- straight back in. google_id below closes the same-account-different-email
-- case; nothing in a Google-OAuth-only system closes the other one.

-- ── The blocklist ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS participant_bans (
  id              bigserial PRIMARY KEY,
  email           varchar NOT NULL,          -- matched case-insensitively (see index)
  google_id       varchar,                   -- optional: same Google account, new address
  -- Nullable + ON DELETE SET NULL on purpose: the ban must survive a later
  -- delete_participant. The email is the durable key; this is provenance.
  participant_id  integer REFERENCES participants(id) ON DELETE SET NULL,
  reason          varchar,
  banned_by       integer REFERENCES participants(id) ON DELETE SET NULL,
  banned_at       timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,               -- non-NULL = lifted (unban)
  revoked_by      integer REFERENCES participants(id) ON DELETE SET NULL
);

COMMENT ON TABLE participant_bans IS
  'App-level blocklist. Keyed on lower(email) so a ban outlives the participants row (a deleted person cannot re-register). Enforced in the auth callback and the registration funnel; auth.users.banned_until is the independent second layer.';

-- At most one ACTIVE ban per email. Partial, so the full ban history is kept:
-- re-banning after an unban inserts a new row rather than resurrecting the old.
CREATE UNIQUE INDEX IF NOT EXISTS idx_participant_bans_active_email
  ON participant_bans (lower(email)) WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_participant_bans_participant
  ON participant_bans (participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_bans_google
  ON participant_bans (google_id) WHERE google_id IS NOT NULL AND revoked_at IS NULL;

-- Owner-only read. No INSERT/UPDATE/DELETE policy: every write goes through the
-- service-role client in lib/owner/ban.ts, which bypasses RLS — so with RLS on
-- and no write policy, no authenticated/anon client can forge or lift a ban.
-- Same posture as owner_actions (00078).
ALTER TABLE participant_bans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS participant_bans_owner_read ON participant_bans;
CREATE POLICY participant_bans_owner_read ON participant_bans
  FOR SELECT USING (is_owner());

-- ── The question both the app and RLS can ask ──────────────────────────────
-- SECURITY DEFINER so the unauthenticated sign-in path can ask it without a
-- read policy on the table. Returns a bare boolean and leaks nothing else.
CREATE OR REPLACE FUNCTION is_banned_email(check_email varchar)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM participant_bans
     WHERE lower(email) = lower(check_email) AND revoked_at IS NULL
  );
$$;
REVOKE ALL ON FUNCTION is_banned_email(varchar) FROM public;
GRANT EXECUTE ON FUNCTION is_banned_email(varchar) TO anon, authenticated;

COMMENT ON FUNCTION is_banned_email(varchar) IS
  'True when an active (un-revoked) ban exists for this email, case-insensitively. SECURITY DEFINER so the pre-auth sign-in path can call it.';

-- ── Widen the owner audit vocabulary ───────────────────────────────────────
-- owner_actions.action was CHECK-locked to archive|reset|delete (00078). Ban and
-- unban are their own verbs and must not be logged as 'archive' — the stopgap
-- rows written before this migration did exactly that, with detail->>'kind'
-- carrying the real verb. They are left as-is; no backfill.
ALTER TABLE owner_actions DROP CONSTRAINT IF EXISTS owner_actions_action_check;
ALTER TABLE owner_actions ADD CONSTRAINT owner_actions_action_check
  CHECK (action IN ('archive', 'reset', 'delete', 'ban', 'unban'));

-- DOWN:
-- ALTER TABLE owner_actions DROP CONSTRAINT IF EXISTS owner_actions_action_check;
-- ALTER TABLE owner_actions ADD CONSTRAINT owner_actions_action_check
--   CHECK (action IN ('archive','reset','delete'));  -- fails if ban/unban rows exist
-- DROP FUNCTION IF EXISTS is_banned_email(varchar);
-- DROP TABLE IF EXISTS participant_bans;
