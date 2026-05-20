-- Short-form registration: relax NOT NULL constraints on fields
-- the short form won't collect, add contact_consent, and create
-- a case-insensitive email uniqueness index.

-- UP

ALTER TABLE participants
  ALTER COLUMN state DROP NOT NULL,
  ALTER COLUMN neighborhood DROP NOT NULL,
  ALTER COLUMN dcpl_card DROP NOT NULL,
  ALTER COLUMN work_situation DROP NOT NULL,
  ALTER COLUMN main_focus DROP NOT NULL,
  ALTER COLUMN ai_tool_familiarity DROP NOT NULL,
  ALTER COLUMN text_updates DROP NOT NULL;

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS contact_consent BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS participants_email_lower_idx
  ON participants (LOWER(email));

-- DOWN (manual rollback):
-- UPDATE participants SET state = COALESCE(state, 'unknown'), neighborhood = COALESCE(neighborhood, 'unknown'), dcpl_card = COALESCE(dcpl_card, 'unknown'), work_situation = COALESCE(work_situation, 'unknown'), main_focus = COALESCE(main_focus, 'unknown'), ai_tool_familiarity = COALESCE(ai_tool_familiarity, 0), text_updates = COALESCE(text_updates, false);
-- ALTER TABLE participants ALTER COLUMN state SET NOT NULL, ALTER COLUMN neighborhood SET NOT NULL, ALTER COLUMN dcpl_card SET NOT NULL, ALTER COLUMN work_situation SET NOT NULL, ALTER COLUMN main_focus SET NOT NULL, ALTER COLUMN ai_tool_familiarity SET NOT NULL, ALTER COLUMN text_updates SET NOT NULL;
-- ALTER TABLE participants DROP COLUMN IF EXISTS contact_consent;
-- DROP INDEX IF EXISTS participants_email_lower_idx;
