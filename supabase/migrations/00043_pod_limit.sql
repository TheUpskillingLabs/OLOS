-- 00043_pod_limit.sql
-- Pods-per-member is a per-cycle admin setting, not a hardcoded constant
-- (owner decision — supersedes the hardcoded 2-pod cap; roadmap §2.1's
-- "move the cap to cycle_config"). Default 1: a participant joins one pod
-- per cycle unless an admin raises the limit. Enforced in the pod register
-- routes (participant + admin); no fixed unique index because the ceiling
-- is configurable, so it can't be a hard 1-per-cycle DB constraint.
--
-- Idempotent + re-runnable (house style). Existing rows inherit DEFAULT 1
-- on ADD COLUMN.
--
-- DOWN:
--   ALTER TABLE cycle_config DROP CONSTRAINT IF EXISTS cycle_config_pod_limit_positive;
--   ALTER TABLE cycle_config DROP COLUMN IF EXISTS pod_limit;

ALTER TABLE cycle_config
  ADD COLUMN IF NOT EXISTS pod_limit INT NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cycle_config_pod_limit_positive'
  ) THEN
    ALTER TABLE cycle_config
      ADD CONSTRAINT cycle_config_pod_limit_positive CHECK (pod_limit >= 1);
  END IF;
END $$;

COMMENT ON COLUMN cycle_config.pod_limit IS
  'Max active pod memberships a participant may hold in this cycle (admin-editable; default 1). Enforced in the pod register routes.';
