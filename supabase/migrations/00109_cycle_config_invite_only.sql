-- 00109_cycle_config_invite_only.sql
--
-- Invite-only participant cycles (docs/ORG_CYCLES.md §5a). For the dogfooding
-- quarter the org runs the full participant (mode='open') cycle machinery —
-- problem statements, voting, pod formation, projects, the Friday Learning Log —
-- on its own team, with ONE difference from a public cohort: nobody self-
-- registers. Admins invite people (a cycle-only invitation already enrolls on
-- acceptance, lib/auth/invitations.ts) and every self-serve entry point
-- (join ceremony, agreement, interest, pod register) 403s anyone without an
-- enrollment while this flag is set.
--
-- Lives on cycle_config (not cycles) because the admin config PATCH route is
-- the one established write path for per-cycle knobs. Defaults FALSE so every
-- existing cycle keeps today's open registration.
--
-- Idempotent + re-runnable.
--
-- DOWN:
--   ALTER TABLE cycle_config DROP COLUMN IF EXISTS invite_only;

ALTER TABLE cycle_config
  ADD COLUMN IF NOT EXISTS invite_only BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN cycle_config.invite_only IS
  'When true, self-serve cycle registration is off: members join only via admin invitations (00109).';
