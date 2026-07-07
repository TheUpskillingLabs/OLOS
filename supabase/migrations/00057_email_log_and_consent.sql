-- 00057_email_log_and_consent.sql — onboarding redesign (generated from docs/DB_CHANGES_ONBOARDING.md rev 2)
-- Copy into OLOS's supabase/migrations/ — see handoff-to-olos/README.md

-- The welcome-summary email's audit trail (every path ends on the thank-you,
-- which promises this email).
CREATE TABLE IF NOT EXISTS email_log (
  id              serial PRIMARY KEY,
  participant_id  integer REFERENCES participants(id) ON DELETE CASCADE,
  kind            varchar NOT NULL,           -- 'welcome_summary' | future kinds
  to_email        varchar NOT NULL,
  subject         text NOT NULL,
  payload         jsonb,                      -- the summary rows as sent
  sent_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_log_participant ON email_log (participant_id, kind);
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

-- Consent consolidation: contact_consent (DEFAULT false — a genuine opt-in) is
-- the single marketing permission. photo_video_consent stays (different purpose).
COMMENT ON COLUMN participants.text_updates  IS 'LEGACY — superseded by contact_consent (2026-07)';
COMMENT ON COLUMN participants.email_updates IS 'LEGACY — superseded by contact_consent (2026-07)';
COMMENT ON COLUMN participants.comms_consent IS 'LEGACY — superseded by contact_consent (2026-07)';
-- Optional one-time reconciliation — POLICY DECISION, needs legal sign-off;
-- skipping it is the conservative option:
-- UPDATE participants SET contact_consent = true
-- WHERE contact_consent = false AND (email_updates = true OR comms_consent = true);

COMMENT ON COLUMN participants.dcpl_card IS 'LEGACY intake (pre-2026-07 flow)';
COMMENT ON COLUMN participants.dcpl_info IS 'LEGACY intake (pre-2026-07 flow)';
COMMENT ON COLUMN participants.participation_commitment IS 'LEGACY intake (pre-2026-07 flow)';
COMMENT ON COLUMN participants.main_focus IS 'LEGACY intake (pre-2026-07 flow)';
