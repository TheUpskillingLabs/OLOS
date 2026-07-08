-- 00063_pod_dissolution.sql
-- Pods are ephemeral (owner constraint, docs/LOCAL_LABS.md +
-- SECTOR_MODEL.md §6): archiving a cycle dissolves its pods so poderators
-- start the next cohort clean, while projects graduate to their sector as
-- open source. This adds the terminal 'dissolved' pod status the close-out
-- writes (lib/cycle/closeout.ts).
--
-- Idempotent + re-runnable.
--
-- DOWN:
--   -- requires zero 'dissolved' rows first:
--   ALTER TABLE pods DROP CONSTRAINT IF EXISTS pods_status_check;
--   ALTER TABLE pods ADD CONSTRAINT pods_status_check
--     CHECK (status IN ('forming', 'active', 'inactive')) NOT VALID;

ALTER TABLE pods DROP CONSTRAINT IF EXISTS pods_status_check;
ALTER TABLE pods ADD CONSTRAINT pods_status_check
  CHECK (status IN ('forming', 'active', 'inactive', 'dissolved')) NOT VALID;
