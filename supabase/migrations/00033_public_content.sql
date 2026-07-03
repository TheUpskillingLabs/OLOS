-- Public content tables (onboarding-proto port, the mini-CMS → real CMS).
--
-- The prototype's content directories map here 1:1 (HANDOFF.md §4):
--   events/data.js    → events    (Luma-shaped cache rows; §3 — until the live
--                                  Luma sync lands, this table IS the source)
--   library/data.js   → resources (§4 — the Learning Library CMS)
--   labs/data.js      → metros    (§1.1) + metro_waitlist_signups (§1.1b)
-- plus event_rsvps: the email-only public RSVP (never account-gated — owner rule).
--
-- The slug is the URL contract: /events/[slug], /library/[slug], /labs/[slug].
-- Content is edited in these tables (admin Entity Explorer reads them already);
-- body/gallery/tags are JSONB arrays matching the prototype's shapes.

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  api_id VARCHAR(100) UNIQUE,
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  kind VARCHAR(50),
  start_at TIMESTAMP NOT NULL,  -- local wall time, rendered as written
  end_at TIMESTAMP,
  location_type VARCHAR(20) NOT NULL DEFAULT 'in_person'
    CHECK (location_type IN ('in_person', 'virtual')),
  location_name VARCHAR(255),
  img VARCHAR(255),
  grad VARCHAR(20),
  cost VARCHAR(50) NOT NULL DEFAULT 'Free',
  host VARCHAR(255),
  description TEXT,
  bring VARCHAR(255),
  body JSONB,
  gallery JSONB,
  anchor BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resources (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  content_type VARCHAR(30) NOT NULL DEFAULT 'guide'
    CHECK (content_type IN ('guide', 'recording', 'template', 'course', 'playbook')),
  meta VARCHAR(100),
  img VARCHAR(255),
  grad VARCHAR(20),
  summary TEXT,
  tags JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'published',
  from_line VARCHAR(255),  -- commons provenance ("BenefitsBot · Spring 2026 Cycle")
  author VARCHAR(255),
  url VARCHAR(500),
  license VARCHAR(100) DEFAULT 'CC BY 4.0',
  body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Two states only (owner decision): 'active' (DC) or 'waitlist'.
-- waiting_baseline carries the pre-launch list size; the rendered count is
-- baseline + COUNT(metro_waitlist_signups).
CREATE TABLE IF NOT EXISTS metros (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  st VARCHAR(5),
  status VARCHAR(20) NOT NULL DEFAULT 'waitlist'
    CHECK (status IN ('active', 'waitlist')),
  partner VARCHAR(255),
  members INTEGER,
  waiting_baseline INTEGER NOT NULL DEFAULT 0,
  blurb TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metro_waitlist_signups (
  id SERIAL PRIMARY KEY,
  metro_id INTEGER NOT NULL REFERENCES metros(id),
  participant_id INTEGER NOT NULL REFERENCES participants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (metro_id, participant_id)
);

-- Email-only public RSVP (owner rule: free events are never account-gated).
CREATE TABLE IF NOT EXISTS event_rsvps (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  email VARCHAR(320) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, email)
);

-- RLS: the content tables are the public web — anon SELECT of published rows
-- is the point. Signups/RSVPs are write-side records: no public read; all
-- writes go through service-role API routes.
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE metros ENABLE ROW LEVEL SECURITY;
ALTER TABLE metro_waitlist_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS events_public_read ON events;
CREATE POLICY events_public_read ON events
  FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS resources_public_read ON resources;
CREATE POLICY resources_public_read ON resources
  FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS metros_public_read ON metros;
CREATE POLICY metros_public_read ON metros
  FOR SELECT USING (true);
DROP POLICY IF EXISTS metro_waitlist_signups_select_own ON metro_waitlist_signups;
CREATE POLICY metro_waitlist_signups_select_own ON metro_waitlist_signups
  FOR SELECT USING (
    participant_id IN (
      SELECT id FROM participants WHERE auth_user_id = auth.uid()
    )
  );

-- DOWN (manual rollback):
-- DROP TABLE IF EXISTS event_rsvps;
-- DROP TABLE IF EXISTS metro_waitlist_signups;
-- DROP TABLE IF EXISTS metros;
-- DROP TABLE IF EXISTS resources;
-- DROP TABLE IF EXISTS events;
