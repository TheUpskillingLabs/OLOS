-- Event location: keep the full postal address and the virtual join link.
--
-- WHY: locationOf() in lib/integrations/luma.ts collapses Luma's
-- geo_address_json down to ONE string — the first non-empty of name,
-- place_name, full_address, address, city. Which one you get therefore depends
-- on what Luma happened to send, so `location_name` is sometimes a venue
-- ("American University") and sometimes a full street address. That is fine for
-- a display label and useless for a map link, which needs a real address.
--
-- Splitting the two lets the detail page show the short venue name while
-- linking to Google Maps with the full address (no API key needed — the same
-- maps.google.com/search URL Luma's own event page uses), and lets the .ics
-- carry an address a calendar app can actually resolve.
--
-- `meeting_url` closes a related gap: Luma sends it for virtual events and the
-- sync has always dropped it, so online events render "Online — we'll send the
-- link" with no link.
--
-- Both columns are Luma-owned: the sync overwrites them every tick alongside
-- location_type / location_name (see the ownership list in luma.ts's header).
-- Nullable with no default — legacy rows simply have no address until the next
-- sync fills one in, and every read site falls back to `location_name`.
--
-- Plan: docs/proposals/luma-driven-event-pages.md (Phase 3)

-- `sponsors` is the third column here rather than its own migration, per the
-- batch-at-write-time rule in supabase/CLAUDE.md: same table, same PR, same
-- subject (what the event page can show about where and with whom it happens).
--
-- Unlike the two above it is EDITORIAL, not Luma-owned: Luma renders sponsor
-- logos on its own page but does not expose them in the events API, so the sync
-- must never touch this column. Shape is an array of {src, alt}, where `src` is
-- a path under /public (or an absolute URL):
--   [{"src": "/assets/american-university.webp", "alt": "American University"}]

-- `stats` is editorial for the same reason as `sponsors`: the four numerals on
-- the anchor-event page ("12 weeks per Build Cycle", "0 credentials required")
-- are editorial framing, not facts Luma holds, and cannot be inferred from prose.
-- Shape: [{"n": "12", "label": "weeks per Build Cycle"}]. Optional — a short
-- workshop simply has none and the section does not render.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS location_address VARCHAR(500),
  ADD COLUMN IF NOT EXISTS meeting_url      VARCHAR(500),
  ADD COLUMN IF NOT EXISTS sponsors         JSONB,
  ADD COLUMN IF NOT EXISTS stats            JSONB;

COMMENT ON COLUMN events.location_address IS
  'Full postal address from Luma geo_address_json (full_address), for map links and .ics LOCATION. Luma-owned. location_name stays the short display label.';

COMMENT ON COLUMN events.meeting_url IS
  'Virtual join link from Luma (meeting_url). Luma-owned. Only meaningful when location_type = ''virtual''.';

COMMENT ON COLUMN events.sponsors IS
  'EDITORIAL, never written by the Luma sync (Luma shows sponsor logos but does not expose them in its API). Array of {src, alt, bg?}; src is a /public path or absolute URL, bg = "dark" for knockout art.';

COMMENT ON COLUMN events.stats IS
  'EDITORIAL, never synced. Array of {n, label} for the anchor-page numeral row. Optional: short events have none and the section is omitted.';

-- DOWN:
-- ALTER TABLE events
--   DROP COLUMN IF EXISTS location_address,
--   DROP COLUMN IF EXISTS meeting_url,
--   DROP COLUMN IF EXISTS sponsors,
--   DROP COLUMN IF EXISTS stats;
