-- 00051_spotlights.sql
-- Upskiller Spotlights (onboarding-proto's stories.html): public member stories
-- plus their submission pipeline, in one table. A "Share your story" submission
-- is a row with status='submitted' and only name + story filled; the Labs team
-- enriches the editorial fields (role, tag, quote, grad, slug) and flips
-- status='published'. The public /stories page shows published rows only and
-- launches empty until real, consented stories are published — the same
-- empty-until-real posture the Library took (migration 00036). Never
-- auto-published (owner decision, concierge review).
--
-- Idempotent + re-runnable.
--
-- DOWN:
--   DROP TABLE IF EXISTS spotlights;

CREATE TABLE IF NOT EXISTS spotlights (
  id              SERIAL PRIMARY KEY,
  slug            VARCHAR(200) UNIQUE,          -- set at publish; #s-{slug} deep link
  name            VARCHAR(200) NOT NULL,
  role            VARCHAR(200),                 -- editorial ("Civic & Elections Cycle")
  tag             VARCHAR(20) NOT NULL DEFAULT 'other'
                    CHECK (tag IN ('builder', 'mentor', 'career_changer', 'other')),
  tag_label       VARCHAR(60),                  -- display label ("Career changer")
  quote           TEXT,                         -- editorial pull-quote
  story           JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array of paragraph strings
  grad            VARCHAR(20) NOT NULL DEFAULT 'm-teal'
                    CHECK (grad IN ('m-teal', 'm-forest', 'm-navy')),
  submitter_email VARCHAR(320),                 -- optional contact from the share form
  status          VARCHAR(20) NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('submitted', 'published', 'hidden')),
  sort_order      INT NOT NULL DEFAULT 0,
  ip_hash         VARCHAR(64),                  -- sha256(ip) — per-IP submit throttle
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_spotlights_status ON spotlights(status);
CREATE INDEX IF NOT EXISTS idx_spotlights_ip ON spotlights(ip_hash, created_at);

DROP TRIGGER IF EXISTS trg_spotlights_updated_at ON spotlights;
CREATE TRIGGER trg_spotlights_updated_at BEFORE UPDATE ON spotlights
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Public reads published rows only; every write goes through a service-role
-- route — the public share endpoint forces status='submitted', admin routes
-- enrich + publish. Mirrors the events/resources anon-SELECT-published posture.
ALTER TABLE spotlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS spotlights_select_published ON spotlights;
CREATE POLICY spotlights_select_published ON spotlights FOR SELECT
  USING (status = 'published');
