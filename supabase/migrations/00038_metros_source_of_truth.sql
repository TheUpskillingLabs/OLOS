-- 00038_metros_source_of_truth.sql
--
-- The metros table (00033) becomes the single source for metro assignment,
-- retiring lib/metros.ts's hardcoded map (roadmap Phase 0.5; the funnel had
-- kept writing participants.metro_slug from the TS module, so the column and
-- the table could silently diverge — GAP_AUDIT B5 / DATA_ARCHITECTURE §1).
--
--   1. metros.zip_prefixes — the zip→metro mapping as data (3-digit
--      prefixes; matches the prototype's silent zip→lab assignment). Only
--      the three funnel-assignable metros get prefixes; the DC fallback for
--      unmatched zips lives in the resolver (the active lab is the default,
--      per the prototype's rule).
--   2. FK participants.metro_slug → metros(slug), NOT VALID: enforced for
--      new writes; legacy rows validated as a follow-up. NULLs pass (metro
--      assignment is optional).
--
-- DOWN: ALTER TABLE participants DROP CONSTRAINT participants_metro_slug_fkey;
--       ALTER TABLE metros DROP COLUMN zip_prefixes;

ALTER TABLE metros ADD COLUMN IF NOT EXISTS zip_prefixes TEXT[] NOT NULL DEFAULT '{}';

UPDATE metros SET zip_prefixes = '{200,201,202,203,204,205}' WHERE slug = 'dc';
UPDATE metros SET zip_prefixes = '{210,211,212}' WHERE slug = 'baltimore';
UPDATE metros SET zip_prefixes = '{190,191,192,193,194}' WHERE slug = 'philadelphia';

CREATE INDEX IF NOT EXISTS idx_participants_metro_slug ON participants(metro_slug);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participants_metro_slug_fkey') THEN
    ALTER TABLE participants
      ADD CONSTRAINT participants_metro_slug_fkey
      FOREIGN KEY (metro_slug) REFERENCES metros(slug) NOT VALID;
  END IF;
END $$;
