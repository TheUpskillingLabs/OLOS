-- 00044_directory_columns.sql
-- The community directory (roadmap Phase 2 — Directory + Me §1.8). Adds the
-- member-facing profile columns the /directory grid + /u/[handle] visitor
-- pages read: a url-safe `handle` (the vanity-URL key), `bio`, `headline`, an
-- opt-in `public_profile_visible` flag (default false — members-only this
-- phase), and a normalized `metro_id` FK reconciling the existing `metro_slug`
-- string.
--
-- Handles are auto-generated for EVERY participant (backfill here + a BEFORE
-- INSERT trigger for new rows) so /u/[handle] works for everyone; members can
-- later customize theirs in the profile editor (uniqueness enforced below).
--
-- Security: directory reads never widen participants RLS — the pages serve an
-- explicit display-column allowlist via the service client (GAP_AUDIT RLS
-- decision). No RLS change here.
--
-- Idempotent + re-runnable (house style).
--
-- DOWN:
--   DROP TRIGGER IF EXISTS trg_set_participant_handle ON participants;
--   DROP FUNCTION IF EXISTS set_participant_handle();
--   DROP FUNCTION IF EXISTS slugify_handle(TEXT);
--   ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_metro_id_fkey;
--   ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_handle_format;
--   DROP INDEX IF EXISTS participants_handle_lower_key;
--   ALTER TABLE participants
--     DROP COLUMN IF EXISTS handle, DROP COLUMN IF EXISTS bio,
--     DROP COLUMN IF EXISTS headline, DROP COLUMN IF EXISTS public_profile_visible,
--     DROP COLUMN IF EXISTS metro_id;

-- 1. Columns ---------------------------------------------------------------
ALTER TABLE participants ADD COLUMN IF NOT EXISTS handle VARCHAR(50);
ALTER TABLE participants ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS headline VARCHAR(200);
ALTER TABLE participants ADD COLUMN IF NOT EXISTS public_profile_visible BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS metro_id INT;

-- 2. slugify helper (mirrored in lib/participants/handle.ts — keep in sync) -
CREATE OR REPLACE FUNCTION slugify_handle(txt TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT COALESCE(
    NULLIF(
      left(trim(BOTH '-' FROM regexp_replace(lower(txt), '[^a-z0-9]+', '-', 'g')), 40),
    ''),
  'member');
$$;

-- 3. Backfill a unique handle for every existing participant ---------------
WITH b AS (
  SELECT id,
         slugify_handle(COALESCE(NULLIF(preferred_name, ''), first_name) || '-' || last_name) AS base
  FROM participants
  WHERE handle IS NULL
),
r AS (
  SELECT id, base, ROW_NUMBER() OVER (PARTITION BY base ORDER BY id) AS rn FROM b
)
UPDATE participants p
SET handle = CASE WHEN r.rn = 1 THEN r.base ELSE r.base || '-' || r.rn END
FROM r
WHERE p.id = r.id;

-- 4. Uniqueness (case-insensitive) + format --------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS participants_handle_lower_key
  ON participants (lower(handle)) WHERE handle IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participants_handle_format') THEN
    ALTER TABLE participants
      ADD CONSTRAINT participants_handle_format
      CHECK (handle IS NULL OR handle ~ '^[a-z0-9][a-z0-9-]*$') NOT VALID;
  END IF;
END $$;

-- 5. Auto-generate a handle for new participants ---------------------------
-- NEW.id is populated in BEFORE INSERT (the SERIAL default fires first), so a
-- base collision falls back to the globally-unique `base-<id>`.
CREATE OR REPLACE FUNCTION set_participant_handle()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE base TEXT;
BEGIN
  IF NEW.handle IS NULL OR NEW.handle = '' THEN
    base := slugify_handle(COALESCE(NULLIF(NEW.preferred_name, ''), NEW.first_name) || '-' || NEW.last_name);
    IF EXISTS (SELECT 1 FROM participants WHERE lower(handle) = lower(base)) THEN
      NEW.handle := left(base, 40) || '-' || NEW.id;
    ELSE
      NEW.handle := base;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_participant_handle ON participants;
CREATE TRIGGER trg_set_participant_handle
  BEFORE INSERT ON participants
  FOR EACH ROW EXECUTE FUNCTION set_participant_handle();

-- 6. Normalize metro_slug → metro_id (roadmap §1.8) ------------------------
UPDATE participants p SET metro_id = m.id
FROM metros m WHERE p.metro_slug = m.slug AND p.metro_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participants_metro_id_fkey') THEN
    ALTER TABLE participants
      ADD CONSTRAINT participants_metro_id_fkey
      FOREIGN KEY (metro_id) REFERENCES metros(id) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_participants_metro_id ON participants(metro_id);

COMMENT ON COLUMN participants.handle IS
  'URL-safe vanity handle for /u/[handle]; auto-generated (trigger) + member-editable. Unique, case-insensitive.';
COMMENT ON COLUMN participants.public_profile_visible IS
  'Opt-in flag for a future PUBLIC (non-authed) profile tier. Default false; the members-only directory ignores it.';
