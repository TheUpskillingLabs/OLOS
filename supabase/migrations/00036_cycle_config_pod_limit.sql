-- ROADMAP §2.1: the per-cycle pod cap (how many pods one participant may join)
-- was hardcoded as `>= 2` in app/api/pods/[pod_id]/register/route.ts and
-- app/api/admin/pods/[pod_id]/memberships/route.ts, plus several UI copy sites.
-- Promote it to config so operators can widen it for early/small cohorts
-- without a code change. Existing cycle_config RLS (00002) covers the new
-- column; no policy change needed.
--
-- Default 2 preserves current behavior for existing cycles.

ALTER TABLE cycle_config
  ADD COLUMN IF NOT EXISTS pod_limit SMALLINT NOT NULL DEFAULT 2;
