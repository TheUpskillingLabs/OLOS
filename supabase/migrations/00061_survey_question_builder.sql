-- 00061_survey_question_builder.sql
-- The full question builder for field surveys — extends 00053 (00060 is org cycles). Until now the
-- instrument's 7 questions were hardcoded in the public flow
-- (app/(survey)/survey/[slug]/survey-flow.tsx). This makes questions
-- data-driven so cycle admins can author/edit/reorder them, while the seeded
-- Civics & Elections survey renders byte-for-byte identically and every
-- existing survey_responses row stays valid.
--
-- Design: survey_responses stays the SUBMISSION ENVELOPE (participant_id,
-- ip_hash, moderation_status, consent_version, created_at) — untouched, so
-- rate-limiting, the response count, the anonymous path, and moderation all
-- keep working. Only the question CONTENT becomes dynamic:
--   survey_questions        — the builder-defined questions.
--   survey_response_answers — generic per-question answers (custom questions).
-- The seeded "system" questions carry a `response_column` back-pointer so their
-- answers keep writing to the existing typed columns (observation, standpoint,
-- salience, mentor_interest, consent_participation + the contact fan-out). That
-- means NO backfill: old rows are already valid, new civics rows land in the
-- same columns, and downstream readers (CSV export, future Ortelius extraction
-- of `observation`) keep working.
--
-- Idempotent + re-runnable.
--
-- DOWN:
--   DROP TABLE IF EXISTS survey_response_answers;
--   DROP TABLE IF EXISTS survey_questions;
--   ALTER TABLE survey_responses ALTER COLUMN observation SET NOT NULL;

-- Relax observation so a builder survey without an observation question can
-- still insert. Existing rows already satisfy this; civics keeps a required
-- observation question, so its submit gate is unchanged.
ALTER TABLE survey_responses ALTER COLUMN observation DROP NOT NULL;

-- ── survey_questions — the builder-defined instrument questions ──────────────
CREATE TABLE IF NOT EXISTS survey_questions (
  id               BIGSERIAL PRIMARY KEY,
  field_survey_id  INT NOT NULL REFERENCES field_surveys(id) ON DELETE CASCADE,
  position         INT NOT NULL,                       -- 0-based order in the flow
  question_key     VARCHAR(60) NOT NULL,               -- stable slug ('observation', 'q_a1b2')
  question_type    VARCHAR(20) NOT NULL CHECK (question_type IN
                     ('short_text','long_text','single_select','multi_select',
                      'scale','yes_no','consent','contact')),
  prompt           TEXT NOT NULL,                      -- FlowStep.q
  help             TEXT,                               -- FlowStep.help
  placeholder      TEXT,                               -- FlowStep.ph
  required         BOOLEAN NOT NULL DEFAULT false,
  config           JSONB NOT NULL DEFAULT '{}',        -- type-specific (options, labels, agreement, fields, min)
  -- Back-compat pointer. When set, answers coerce into this survey_responses
  -- column instead of survey_response_answers. NULL = generic answer row.
  response_column  VARCHAR(40),
  -- Seeded/special question: the builder locks its type, response_column, and
  -- seeded options, and forbids deleting it (downstream columns depend on it).
  is_system        BOOLEAN NOT NULL DEFAULT false,
  active           BOOLEAN NOT NULL DEFAULT true,      -- soft-delete: retire without losing historical answers
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (field_survey_id, question_key)
);
CREATE INDEX IF NOT EXISTS idx_survey_questions_survey
  ON survey_questions(field_survey_id, position);

DROP TRIGGER IF EXISTS trg_survey_questions_updated_at ON survey_questions;
CREATE TRIGGER trg_survey_questions_updated_at BEFORE UPDATE ON survey_questions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── survey_response_answers — generic per-question answers ───────────────────
-- One row per answered custom question (response_column IS NULL). value is
-- JSONB: a string, number, or string[] depending on the question type.
CREATE TABLE IF NOT EXISTS survey_response_answers (
  id           BIGSERIAL PRIMARY KEY,
  response_id  BIGINT NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
  question_id  BIGINT NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
  value        JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (response_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_sra_response ON survey_response_answers(response_id);
CREATE INDEX IF NOT EXISTS idx_sra_question ON survey_response_answers(question_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- survey_questions: public SELECT of an open survey's questions (mirrors the
-- field_surveys anon-SELECT posture; the flow itself reads via service-role).
-- No write policy — builder writes go through the service-role admin API.
ALTER TABLE survey_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS survey_questions_select_open ON survey_questions;
CREATE POLICY survey_questions_select_open ON survey_questions FOR SELECT
  USING (EXISTS (SELECT 1 FROM field_surveys s
                 WHERE s.id = survey_questions.field_survey_id AND s.status = 'open'));

-- survey_response_answers: no policy — service-role only (mirrors survey_responses).
ALTER TABLE survey_response_answers ENABLE ROW LEVEL SECURITY;

-- ── Seed the Civics & Elections questions ───────────────────────────────────
-- Reproduces surveySteps("Civics & Elections") exactly (the copy was hardcoded
-- with the domain interpolated). All is_system=true; the response-column ones
-- map to the existing typed columns so old rows stay valid and new rows land
-- uniformly. Idempotent via ON CONFLICT (field_survey_id, question_key).
INSERT INTO survey_questions
  (field_survey_id, position, question_key, question_type, prompt, help, placeholder, required, config, response_column, is_system)
SELECT c.id, q.position, q.question_key, q.question_type, q.prompt, q.help, q.placeholder, q.required, q.config::jsonb, q.response_column, true
FROM (SELECT id FROM field_surveys WHERE share_slug = 'civics') c,
(VALUES
  (0, 'observation', 'long_text',
     'What are you observing in the field of civics & elections?',
     'What feels stuck, broken, or missing — a problem that keeps coming back no matter what people try? A sentence is fine. So is a page.',
     'Just tell us what you see.', true,
     '{}',
     'observation'),
  (1, 'experience', 'multi_select',
     'What''s your experience with this?',
     'Optional — pick any that apply. It helps us weigh who''s speaking.',
     NULL, false,
     '{"min":0,"options":[{"v":"work_in_field","label":"I work in this field"},{"v":"affected","label":"I''ve been personally affected by it"},{"v":"tried_to_fix","label":"I''ve tried to fix something like this before"},{"v":"research","label":"I research or study this area"},{"v":"pay_attention","label":"I just pay close attention"},{"v":"other","label":"Other"}]}',
     'standpoint'),
  (2, 'salience', 'scale',
     'How much does this matter to you personally?',
     'Optional.', NULL, false,
     '{"lowLabel":"I noticed it in passing","highLabel":"This is something I think about a lot"}',
     'salience'),
  (3, 'prior_attempts', 'long_text',
     'Has anyone tried to address this before?',
     'Even if it didn''t work — especially if it didn''t work. What happened? Optional.',
     'What was tried, and how it went…', false,
     '{}',
     'prior_attempts'),
  (4, 'contact', 'contact',
     'Want to stay in touch?',
     'Optional. Share these only if you''re open to program participants following up on your observation — your info goes only to those who use it. Leave blank to stay anonymous.',
     NULL, false,
     '{"fields":[{"id":"name","label":"Your name","ph":"e.g. Priya Shah","half":true},{"id":"email","label":"Email","ph":"you@example.com","half":true},{"id":"phone","label":"Phone (optional)","ph":"If you prefer a call or text"}]}',
     NULL),
  (5, 'mentor', 'yes_no',
     'Interested in mentoring in the Civics & Elections Build Cycle?',
     'Mentors guide a pod through the cycle. Say yes and add your name + email above so we can reach you.',
     NULL, false,
     '{"options":[{"v":"yes","label":"Yes, I''m interested"},{"v":"no","label":"Not right now"}]}',
     'mentor_interest'),
  (6, 'consent', 'consent',
     'One last thing',
     NULL, NULL, true,
     '{"agreementTitle":"How your observation is used","agreement":[{"h":"What you''re contributing to","p":"The Upskilling Labs collects field observations to choose the problems its next Civics & Elections Build Cycle takes on. Your observation joins an open, participant-built insights repository; everything Upskillers produce from it is open-source."},{"h":"Voluntary and anonymous","p":"Submitting is voluntary, and your observation is anonymous unless you shared contact details. You can share as little or as much as you like."}],"text":"I have read and understood the above. I consent to my submission being used by The Upskilling Labs in the development of public projects and shared with program participants for research and project-development purposes."}',
     'consent_participation')
) AS q(position, question_key, question_type, prompt, help, placeholder, required, config, response_column)
ON CONFLICT (field_survey_id, question_key) DO NOTHING;
