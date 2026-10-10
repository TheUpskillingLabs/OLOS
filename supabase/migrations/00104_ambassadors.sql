-- 00104_ambassadors.sql
--
-- The Ambassador role moves into OLOS (docs/ambassadors/CLAUDE.md). It was a
-- static prototype in the `ambassadors` repo that kept everything on the
-- applicant's phone: an unsigned invite link was the pre-approval, the
-- "application" was a text message to the coordinator, and nothing could be
-- counted. Here it becomes records:
--
--   1. participant_roles learns 'ambassador'. The grant IS the ambassador
--      status; it's lab-scoped (lab_id) so a Lab's leads coordinate their own
--      ambassadors, and granted_by records the coordinator (or the inviter,
--      for a pre-approved invite).
--   2. agreement_acceptances learns doc 'ambassador' (+ source
--      'ambassador_flow'). Terms §3 is updated in the same PR — it said the
--      Build Cycle agreement was the only additional agreement.
--   3. ambassador_applications — one row per person: orientation (the
--      ten-question quiz), the agreement version, who brought them in, and
--      the coordinator's decision. Lifecycle: started → pending → approved |
--      declined; approved → stepped_back when the role is revoked.
--   4. ambassador_invites — a coordinator's pre-approved invite. The token is
--      a bearer secret in the link (as the prototype's link was), single-use,
--      and expires; when an email is set it must match the applicant's.
--   5. ambassador_nominations — an ambassador suggests someone; the
--      coordinator decides and may turn it into an invite.
--   6. ambassador_step_progress — which of the guide's five steps are done,
--      so a coordinator can see who's ready. The ambassador's story draft,
--      practice self-checks and "who will you ask" names stay on their own
--      device by design: the asks are third parties who agreed to nothing.
--
-- All writes go through service-role API routes (app/api/ambassadors/**),
-- which enforce the lab scope (lib/auth/lab.ts). RLS here is the read
-- backstop: self + admin, same posture as agreement_acceptances (00058).
--
-- Idempotent + re-runnable.
--
-- DOWN:
--   DROP TABLE IF EXISTS ambassador_step_progress;
--   DROP TABLE IF EXISTS ambassador_nominations;
--   DROP TABLE IF EXISTS ambassador_applications;
--   DROP TABLE IF EXISTS ambassador_invites;
--   UPDATE participant_roles SET revoked_at = now() WHERE role = 'ambassador' AND revoked_at IS NULL;
--   -- then restore the 00064 role CHECK and the 00055 doc/source CHECKs.

-- ── 1. The role ──────────────────────────────────────────────────────────
ALTER TABLE participant_roles DROP CONSTRAINT IF EXISTS participant_roles_role_check;
ALTER TABLE participant_roles ADD CONSTRAINT participant_roles_role_check CHECK (role IN (
  'upskiller','volunteer','mentor','events',
  'poderator','admin','owner','observer','developer',
  'lab_lead','co_lead','member','dri','contributor','staff','tester',
  'ambassador'));

-- ── 2. The agreement ─────────────────────────────────────────────────────
ALTER TABLE agreement_acceptances DROP CONSTRAINT IF EXISTS agreement_acceptances_doc_check;
ALTER TABLE agreement_acceptances ADD CONSTRAINT agreement_acceptances_doc_check
  CHECK (doc IN ('participation','guidelines','mentor','ambassador'));
ALTER TABLE agreement_acceptances DROP CONSTRAINT IF EXISTS agreement_acceptances_source_check;
ALTER TABLE agreement_acceptances ADD CONSTRAINT agreement_acceptances_source_check
  CHECK (source IN ('signup','mentor_flow','welcome_back','re_acceptance','ambassador_flow'));

-- ── 4. Invites (before applications, which reference them) ──────────────
CREATE TABLE IF NOT EXISTS ambassador_invites (
  id                      serial PRIMARY KEY,
  token                   varchar(64) NOT NULL UNIQUE,
  first_name              varchar(100) NOT NULL,
  last_name               varchar(100),
  email                   varchar(320),
  note                    varchar(200),
  -- The name the invitee sees ("Priya invited you"), as the coordinator typed it.
  inviter_name            varchar(100) NOT NULL,
  invited_by              integer REFERENCES participants(id) ON DELETE SET NULL,
  lab_id                  integer REFERENCES metros(id) ON DELETE SET NULL,
  nomination_id           integer,
  created_at              timestamptz NOT NULL DEFAULT now(),
  expires_at              timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  accepted_at             timestamptz,
  accepted_participant_id integer REFERENCES participants(id) ON DELETE SET NULL,
  revoked_at              timestamptz
);
CREATE INDEX IF NOT EXISTS idx_amb_invites_lab ON ambassador_invites (lab_id);

-- ── 3. Applications ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ambassador_applications (
  id                         serial PRIMARY KEY,
  participant_id             integer NOT NULL UNIQUE REFERENCES participants(id) ON DELETE CASCADE,
  -- The Lab whose coordinator decides: the applicant's active Lab at submit
  -- (participants.metro_id), else the inviter's Lab. NULL = HQ decides.
  lab_id                     integer REFERENCES metros(id) ON DELETE SET NULL,
  status                     varchar(20) NOT NULL DEFAULT 'started'
                             CHECK (status IN ('started','pending','approved','declined','stepped_back')),
  oriented_at                timestamptz,  -- watched the film or read the short version
  quiz_version               varchar(40),
  quiz_score                 smallint,
  quiz_total                 smallint,
  quiz_passed_at             timestamptz,
  agreement_version          varchar(40),
  agreement_accepted_at      timestamptz,
  referred_by                varchar(255),
  referred_by_participant_id integer REFERENCES participants(id) ON DELETE SET NULL,
  invite_id                  integer REFERENCES ambassador_invites(id) ON DELETE SET NULL,
  submitted_at               timestamptz,
  decided_at                 timestamptz,
  decided_by                 integer REFERENCES participants(id) ON DELETE SET NULL,
  decision_note              varchar(500),
  -- The guide's five steps are done and they told their coordinator.
  ready_at                   timestamptz,
  -- The coordinator handed over the button, in person.
  button_given_at            timestamptz,
  button_given_by            integer REFERENCES participants(id) ON DELETE SET NULL,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amb_apps_lab_status ON ambassador_applications (lab_id, status);
CREATE INDEX IF NOT EXISTS idx_amb_apps_referrer
  ON ambassador_applications (referred_by_participant_id) WHERE referred_by_participant_id IS NOT NULL;

-- ── 5. Nominations ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ambassador_nominations (
  id              serial PRIMARY KEY,
  nominator_id    integer NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  lab_id          integer REFERENCES metros(id) ON DELETE SET NULL,
  nominee_name    varchar(120) NOT NULL,
  how_known       varchar(300),
  reason          varchar(1000) NOT NULL,
  -- Only if the nominee said it's OK to pass on (the form says so).
  nominee_contact varchar(320),
  status          varchar(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','invited','declined')),
  decided_by      integer REFERENCES participants(id) ON DELETE SET NULL,
  decided_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amb_noms_lab_status ON ambassador_nominations (lab_id, status);

DO $$ BEGIN
  ALTER TABLE ambassador_invites
    ADD CONSTRAINT ambassador_invites_nomination_fk
    FOREIGN KEY (nomination_id) REFERENCES ambassador_nominations(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 6. Guide progress ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ambassador_step_progress (
  participant_id integer NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  step_id        varchar(40) NOT NULL,
  done_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (participant_id, step_id)
);

-- ── RLS: self + admin read; writes via service-role routes only ─────────
ALTER TABLE ambassador_applications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ambassador_invites       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ambassador_nominations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ambassador_step_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amb_apps_select ON ambassador_applications;
CREATE POLICY amb_apps_select ON ambassador_applications FOR SELECT
  USING (participant_id = current_participant_id() OR is_admin());

-- Invites carry a bearer token: admins only through RLS; everyone else
-- reaches an invite through the token-checked routes.
DROP POLICY IF EXISTS amb_invites_select ON ambassador_invites;
CREATE POLICY amb_invites_select ON ambassador_invites FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS amb_noms_select ON ambassador_nominations;
CREATE POLICY amb_noms_select ON ambassador_nominations FOR SELECT
  USING (nominator_id = current_participant_id() OR is_admin());

DROP POLICY IF EXISTS amb_steps_select ON ambassador_step_progress;
CREATE POLICY amb_steps_select ON ambassador_step_progress FOR SELECT
  USING (participant_id = current_participant_id() OR is_admin());
