-- Cycle information-page content — optional admin-authored copy for the public
-- cycle page (/c/[id]). NULL falls back to standard "how a Build Cycle works"
-- copy in the app (lib/cycles/info.ts), so every cycle has a complete page even
-- before anyone edits it.

ALTER TABLE cycles ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE cycles ADD COLUMN IF NOT EXISTS what_you_build TEXT;
