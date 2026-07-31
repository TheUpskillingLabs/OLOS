-- events.about: the full Luma "About Event" text, synced and Luma-owned.
--
-- WHY: the sync captured only a 280-char lede (ledeOf) from Luma's event
-- description, so a session whose Luma page carries paragraphs of real
-- content -- what the workshop covers, host acknowledgements, facilitator
-- bios -- rendered a near-empty detail page on the site (owner report,
-- 2026-07-30). The editorial fields (description / body / bring) are for the
-- Labs' own framing and survive syncs; `about` is the opposite contract:
-- Luma writes it on every tick, so editing the copy on Luma updates the site
-- within the sync interval, and nobody maintains the same text twice.
--
-- Plain text, blank-line-separated paragraphs, rendered as prose by the
-- detail page. Nullable: editorial-only events have nothing to say here.
-- No RLS change -- the column rides the events table's existing policies.

ALTER TABLE events ADD COLUMN IF NOT EXISTS about TEXT;

-- DOWN (reference only):
--   ALTER TABLE events DROP COLUMN IF EXISTS about;
