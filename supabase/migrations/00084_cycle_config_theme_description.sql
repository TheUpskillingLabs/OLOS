-- Per-cycle theme copy for the cycle-registration ceremony's "What <theme>
-- means" info screen. Admin-authored on the cycle config page; when blank the
-- ceremony falls back to generic theme copy (lib/cycles/info.ts). Previously
-- this screen's text was hardcoded to Civics & Elections in ceremony.tsx.
ALTER TABLE cycle_config ADD COLUMN IF NOT EXISTS theme_description TEXT;
