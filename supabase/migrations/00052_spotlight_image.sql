-- 00052_spotlight_image.sql
-- Real headshots on Upskiller Spotlight cards. Until now every /stories card and
-- the landing story row painted the orb placeholder; this adds an optional photo
-- so a published spotlight can carry the member's actual headshot. Nullable —
-- when unset, the render falls back to the orb (the same image-or-orb pattern the
-- content teasers use for events/resources), so existing rows are unaffected and
-- prod stays orb-only until real, consented photos are published.
--
-- Additive, idempotent, re-runnable.
--
-- DOWN:
--   ALTER TABLE spotlights DROP COLUMN IF EXISTS image_url;

ALTER TABLE spotlights ADD COLUMN IF NOT EXISTS image_url TEXT;
