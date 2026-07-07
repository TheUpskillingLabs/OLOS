-- 00061_social_graph.sql
-- The social layer for showcase pages: (1) entity_links — external links (GitHub,
-- LinkedIn, X, website, …) attachable to any participant / pod / project / cycle;
-- (2) follows — a polymorphic follow graph so members can follow users, pods,
-- projects, and cycles. Both mirror the polymorphic, self-scoped shape of
-- saved_items (00050).
--
-- entity_links is world-readable within the members-only app (SELECT USING(true),
-- like sectors 00049); writes go through curator-gated service-role routes, so no
-- client write policy is granted (RLS blocks direct client writes as defense in
-- depth). follows is self-scoped (a member only sees/mutates their own follow
-- rows via current_participant_id(), 00002) — aggregate follower COUNTS and
-- follower lists are read with the service role, which bypasses RLS. Reading a
-- count through the RLS client would return only the viewer's own row (0/1).
--
-- Idempotent + re-runnable.
--
-- DOWN:
--   DROP TABLE IF EXISTS follows;
--   DROP TABLE IF EXISTS entity_links;

-- 1. entity_links -----------------------------------------------------------
-- Polymorphic: (owner_type, owner_id) points at a row in participants / pods /
-- projects / cycles (no cross-table FK, like saved_items). One row per platform
-- per owner — the showcase renders these as an icon row.
CREATE TABLE IF NOT EXISTS entity_links (
  id          SERIAL PRIMARY KEY,
  owner_type  VARCHAR(20) NOT NULL
                CHECK (owner_type IN ('participant', 'pod', 'project', 'cycle')),
  owner_id    INT NOT NULL,
  platform    VARCHAR(30) NOT NULL
                CHECK (platform IN ('github', 'linkedin', 'x', 'website',
                                    'youtube', 'instagram', 'discord', 'other')),
  url         TEXT NOT NULL,
  label       VARCHAR(80),
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_type, owner_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_entity_links_owner
  ON entity_links (owner_type, owner_id, sort_order);

ALTER TABLE entity_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS entity_links_select ON entity_links;
CREATE POLICY entity_links_select ON entity_links FOR SELECT USING (true);
-- No client INSERT/UPDATE/DELETE policy: curator-gated writes run through the
-- service role, which bypasses RLS. RLS therefore blocks any direct client write.

-- 2. follows ----------------------------------------------------------------
-- Polymorphic follow edge: follower_participant_id → (target_type, target_id).
CREATE TABLE IF NOT EXISTS follows (
  id                      SERIAL PRIMARY KEY,
  follower_participant_id INT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  target_type             VARCHAR(20) NOT NULL
                            CHECK (target_type IN ('participant', 'pod', 'project', 'cycle')),
  target_id               INT NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_participant_id, target_type, target_id),
  -- A member can't follow their own profile.
  CONSTRAINT follows_no_self_follow
    CHECK (target_type <> 'participant' OR target_id <> follower_participant_id)
);

-- Follower counts + "who follows this" (service-role reads).
CREATE INDEX IF NOT EXISTS idx_follows_target
  ON follows (target_type, target_id);
-- The viewer's own follow-set — initial button state + directory Following filter.
CREATE INDEX IF NOT EXISTS idx_follows_follower
  ON follows (follower_participant_id, target_type);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
-- Self only: a member reads / creates / removes their own follow rows.
-- current_participant_id() maps the auth JWT → participants.id (00002 helper).
DROP POLICY IF EXISTS follows_select ON follows;
CREATE POLICY follows_select ON follows FOR SELECT
  USING (follower_participant_id = current_participant_id());

DROP POLICY IF EXISTS follows_insert ON follows;
CREATE POLICY follows_insert ON follows FOR INSERT
  WITH CHECK (follower_participant_id = current_participant_id());

DROP POLICY IF EXISTS follows_delete ON follows;
CREATE POLICY follows_delete ON follows FOR DELETE
  USING (follower_participant_id = current_participant_id());
