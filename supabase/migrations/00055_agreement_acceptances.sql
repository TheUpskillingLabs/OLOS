-- 00055_agreement_acceptances.sql — onboarding redesign (generated from docs/DB_CHANGES_ONBOARDING.md rev 2)
-- Copy into OLOS's supabase/migrations/ — see handoff-to-olos/README.md

-- Three versioned documents, separately accepted (Guidelines → Participation
-- Agreement at signup; Mentor Agreement at mentor publish). Events-only signups
-- accept NOTHING — zero rows is a valid state.
-- Version strings come from tools/build-agreements.js (e.g. 'vpa-2026-07-v1');
-- a version bump re-presents the document: the check is "row exists for
-- (participant, doc, CURRENT version)".

CREATE TABLE IF NOT EXISTS agreement_acceptances (
  id              serial PRIMARY KEY,
  participant_id  integer NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  doc             varchar NOT NULL CHECK (doc IN ('participation','guidelines','mentor')),
  version         varchar NOT NULL,
  accepted_at     timestamptz NOT NULL DEFAULT now(),
  source          varchar NOT NULL DEFAULT 'signup'
                  CHECK (source IN ('signup','mentor_flow','welcome_back','re_acceptance'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_agree ON agreement_acceptances (participant_id, doc, version);

-- Backfill from the single-document columns 00031 added.
INSERT INTO agreement_acceptances (participant_id, doc, version, accepted_at)
SELECT id, 'participation', agreement_version, agreement_accepted_at
FROM participants
WHERE agreement_version IS NOT NULL AND agreement_accepted_at IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE agreement_acceptances ENABLE ROW LEVEL SECURITY;
-- participants.agreement_version / agreement_accepted_at: keep until OLOS's 6
-- reader files migrate, then drop in the cleanup migration.
