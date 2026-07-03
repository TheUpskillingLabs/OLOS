-- Onboarding funnel registration fields (onboarding-proto port, stage 1).
--
-- The funnel (role intent → signup flow → Participant Agreement) collects
-- four things the current schema can't hold:
--
--   zip / metro_slug        — the lab is assigned silently from the zip
--                             (owner decision; prototype FLOWS('signup')).
--                             metro_slug is a slug into lib/metros.ts until a
--                             real metros table lands with the labs/waitlist
--                             stage (backend doc §1.1).
--   role_intents            — the view-role-intent multi-select
--                             (cycle / events / volunteer / mentor).
--   referred_by             — "Who referred you?" follow-up; the hear-about
--                             answer itself lands in the existing source column.
--   agreement_version /     — the scroll-gated Participant Agreement acceptance
--   agreement_accepted_at     record (every agreement is versioned; the Open
--                             Cycle Agreement gets its own table §2c later).
--
-- IF NOT EXISTS guards make the migration idempotent against partial
-- application. Single ALTER TABLE batches the adds into one catalog rewrite.

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS zip                   VARCHAR(10),
  ADD COLUMN IF NOT EXISTS metro_slug            VARCHAR(50),
  ADD COLUMN IF NOT EXISTS role_intents          TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS referred_by           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS agreement_version     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS agreement_accepted_at TIMESTAMPTZ;

-- Role intents are an open-ended-but-bounded set; keep writes honest.
ALTER TABLE participants
  DROP CONSTRAINT IF EXISTS participants_role_intents_check;
ALTER TABLE participants
  ADD CONSTRAINT participants_role_intents_check
  CHECK (role_intents <@ ARRAY['cycle', 'events', 'volunteer', 'mentor']::text[]);

-- DOWN: rollback block. Copy into a scratch query to revert in dev.
-- Not auto-applied; Supabase migrations are forward-only.
--
-- ALTER TABLE participants
--   DROP CONSTRAINT IF EXISTS participants_role_intents_check;
-- ALTER TABLE participants
--   DROP COLUMN IF EXISTS zip,
--   DROP COLUMN IF EXISTS metro_slug,
--   DROP COLUMN IF EXISTS role_intents,
--   DROP COLUMN IF EXISTS referred_by,
--   DROP COLUMN IF EXISTS agreement_version,
--   DROP COLUMN IF EXISTS agreement_accepted_at;
