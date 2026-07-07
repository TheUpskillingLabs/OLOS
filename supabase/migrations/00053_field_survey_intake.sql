-- 00053_field_survey_intake.sql
-- SENSEMAKING_FLOW.md §3 (the bedrock) + ORTELIUS_KNOWLEDGE_GRAPH.md §3a — the
-- field-survey intake: the first buildable, gate-free slice of the Data
-- Sensemaker. Replaces the Civics & Elections Google Form with a public,
-- account-free submission surface at /survey/[share_slug], and lays the first
-- Ortelius provenance node (`survey_responses`) — every observation is a node,
-- curation is a later temporal overlay (owner decision 2026-07-05).
--
-- Two tables:
--   field_surveys    — the instrument (one row per sector/cycle problem domain)
--   survey_responses — the observations (the evidence bedrock; anon-capable)
--
-- Governance: gate-free. Collecting consented observations is a form + storage;
-- no in-app LLM. The Ortelius envelope columns land day one so downstream
-- (extraction, canvas, asset_links) is additive, never a rewrite: `source_url`
-- (the evidence-producer gap, ORTELIUS §5 gap #6), `consent_version`,
-- `moderation_status`, `schema_version` (ORTELIUS §5 gap #12 — versioned from
-- day one), and the nullable `participant_id` anonymous path.
--
-- Idempotent + re-runnable.
--
-- DOWN:
--   DROP TABLE IF EXISTS survey_responses;
--   DROP TABLE IF EXISTS field_surveys;

-- ── field_surveys — the instrument ─────────────────────────────────────────
-- One row per sector/cycle problem domain. `about` holds the survey-specific
-- lede; the boilerplate "What is the Labs / where do insights go" copy lives in
-- the page. Public reads are gated on status='open'; writes are service-role.
CREATE TABLE IF NOT EXISTS field_surveys (
  id              SERIAL PRIMARY KEY,
  cycle_id        INT REFERENCES cycles(id),          -- nullable: survey can precede its cycle
  sector_id       INT REFERENCES sectors(id),         -- nullable: the durable commons home
  title           VARCHAR(200) NOT NULL,
  problem_domain  VARCHAR(200),                        -- e.g. "Civics & Elections"
  about           TEXT,                                -- survey-specific lede copy
  share_slug      VARCHAR(200) UNIQUE NOT NULL,        -- /survey/{share_slug}
  status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'open', 'closed')),
  allow_anonymous BOOLEAN NOT NULL DEFAULT true,
  consent_version VARCHAR(20) NOT NULL DEFAULT 'civics-2026-07',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_surveys_status ON field_surveys(status);
CREATE INDEX IF NOT EXISTS idx_field_surveys_sector ON field_surveys(sector_id);

DROP TRIGGER IF EXISTS trg_field_surveys_updated_at ON field_surveys;
CREATE TRIGGER trg_field_surveys_updated_at BEFORE UPDATE ON field_surveys
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── survey_responses — the observations (the evidence bedrock) ──────────────
-- Nullable `participant_id` is the load-bearing anonymous-public path
-- (/s/[share_slug]). Every response is retained as a node; `moderation_status`
-- and later swipe/second signals are a temporal overlay, never a delete.
CREATE TABLE IF NOT EXISTS survey_responses (
  id                    BIGSERIAL PRIMARY KEY,
  field_survey_id       INT NOT NULL REFERENCES field_surveys(id) ON DELETE CASCADE,
  participant_id        INT REFERENCES participants(id),  -- NULL = anonymous public submit
  -- the observation body — the source every future `extract` derives from
  observation           TEXT NOT NULL,
  standpoint            TEXT[] NOT NULL DEFAULT '{}',       -- multi-select; feeds coverage/diversity
  salience              SMALLINT CHECK (salience BETWEEN 1 AND 5),  -- 1–5 intensity, nullable
  prior_attempts        TEXT,                              -- archaeology, nullable
  -- consent + contact (two distinct consents; SENSEMAKING_FLOW §3)
  consent_participation BOOLEAN NOT NULL,                  -- required; gates submit (enforced in API)
  consent_version       VARCHAR(20) NOT NULL,
  contactable           BOOLEAN NOT NULL DEFAULT false,    -- separate, optional contact consent
  submitter_name        VARCHAR(200),
  submitter_email       VARCHAR(320),
  submitter_phone       VARCHAR(40),
  mentor_interest       BOOLEAN NOT NULL DEFAULT false,    -- recruiting side-channel
  -- Ortelius groundwork (additive later, never a rewrite)
  source_url            TEXT,                              -- evidence producer (uploaded-source origin)
  moderation_status     VARCHAR(20) NOT NULL DEFAULT 'pending'
                          CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  schema_version        INT NOT NULL DEFAULT 1,
  ip_hash               VARCHAR(64),                       -- sha256(ip) — per-IP submit throttle
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON survey_responses(field_survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_ip ON survey_responses(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_survey_responses_moderation ON survey_responses(moderation_status);
CREATE INDEX IF NOT EXISTS idx_survey_responses_participant ON survey_responses(participant_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- field_surveys: public SELECT of open surveys (the page reads the instrument
-- anonymously). survey_responses: no public policy — every write goes through
-- the service-role API route (which forces moderation_status='pending' and
-- stamps ip_hash), and reads stay service-role until a consented atlas surface
-- ships. Mirrors the spotlights (00051) anon-SELECT-published posture.
ALTER TABLE field_surveys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS field_surveys_select_open ON field_surveys;
CREATE POLICY field_surveys_select_open ON field_surveys FOR SELECT
  USING (status = 'open');

ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
-- (no policy: service-role only — writes via /api/surveys/[slug]/responses)

-- ── Seed the Civics & Elections instrument ─────────────────────────────────
-- The one config row the /survey/civics page renders. Idempotent.
INSERT INTO field_surveys (title, problem_domain, about, share_slug, status, allow_anonymous)
VALUES (
  'Civics & Elections: Field Survey',
  'Civics & Elections',
  'Observations from people closest to a problem are where the best projects begin. The Upskilling Labs collects observations from workers, researchers, community members, and the general public to identify the problems worth tackling in each cycle.',
  'civics',
  'open',
  true
)
ON CONFLICT (share_slug) DO NOTHING;
