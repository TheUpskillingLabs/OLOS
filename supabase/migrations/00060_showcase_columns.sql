-- 00060_showcase_columns.sql
-- Pod & Project showcase pages (members-only, LinkedIn-style). pods/projects only
-- carried an id, a short name, status, and integration URLs — no place for a
-- description, tagline, logo/cover image, or a "list me in the directory" flag.
-- This adds those page-identity columns to both tables. They're curated by the
-- pod's Poderator (or an admin); members, projects, GitHub repo, and status
-- auto-populate the page.
--
-- Also provisions a public `showcase` Storage bucket for logos + covers, mirroring
-- 00046_avatars_bucket (public read, service-role writes). Kept separate from
-- `avatars` so the two buckets never collide; logo/cover are keyed per-image.
--
-- directory_visible defaults false (opt-in), but existing active/forming pods &
-- projects are backfilled to true so the new /directory tabs aren't empty at
-- launch — pages are members-only and members already see every pod/project, so
-- this is opt-OUT for live entities, opt-IN for future ones.
--
-- Additive + idempotent + re-runnable.
--
-- DOWN:
--   ALTER TABLE pods DROP COLUMN IF EXISTS tagline, DROP COLUMN IF EXISTS description,
--     DROP COLUMN IF EXISTS logo_url, DROP COLUMN IF EXISTS cover_url,
--     DROP COLUMN IF EXISTS directory_visible;
--   ALTER TABLE projects DROP COLUMN IF EXISTS tagline, DROP COLUMN IF EXISTS description,
--     DROP COLUMN IF EXISTS logo_url, DROP COLUMN IF EXISTS cover_url,
--     DROP COLUMN IF EXISTS directory_visible;
--   DELETE FROM storage.buckets WHERE id = 'showcase';

-- 1. Pod showcase columns ---------------------------------------------------
ALTER TABLE pods
  ADD COLUMN IF NOT EXISTS tagline           VARCHAR(200),
  ADD COLUMN IF NOT EXISTS description       TEXT,
  ADD COLUMN IF NOT EXISTS logo_url          TEXT,
  ADD COLUMN IF NOT EXISTS cover_url         TEXT,
  ADD COLUMN IF NOT EXISTS directory_visible BOOLEAN NOT NULL DEFAULT false;

-- 2. Project showcase columns ----------------------------------------------
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS tagline           VARCHAR(200),
  ADD COLUMN IF NOT EXISTS description       TEXT,
  ADD COLUMN IF NOT EXISTS logo_url          TEXT,
  ADD COLUMN IF NOT EXISTS cover_url         TEXT,
  ADD COLUMN IF NOT EXISTS directory_visible BOOLEAN NOT NULL DEFAULT false;

-- 3. Backfill directory visibility for live entities (opt-out for these) ----
UPDATE pods     SET directory_visible = true
  WHERE status IN ('active', 'forming') AND directory_visible = false;
UPDATE projects SET directory_visible = true
  WHERE status IN ('active', 'forming') AND directory_visible = false;

-- 4. Public Storage bucket for logos + covers (mirrors 00046) ---------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'showcase',
  'showcase',
  true,
  5242880, -- 5 MB (covers are wider than avatars)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMENT ON COLUMN pods.directory_visible IS
  'Opt-in flag: include this pod in the members-only /directory Pods tab. Backfilled true for active/forming pods (00060).';
COMMENT ON COLUMN projects.directory_visible IS
  'Opt-in flag: include this project in the members-only /directory Projects tab. Backfilled true for active/forming projects (00060).';
