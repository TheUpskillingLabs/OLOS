-- 00081_metro_archive.sql — owner lifecycle management, Phase 3 (metros)
--
-- WHY: owners can now archive (deactivate) a metro / local lab. metros.status is
-- CHECK-locked to ('active','waitlist') — there is no archived status to reuse — so a
-- nullable archived_at timestamp is the soft-hide flag (NULL = active), mirroring
-- participants.archived_at (00079). Additive + nullable, so every legacy row is
-- already valid. The default metro (is_default, 00062) is never archivable — that
-- guard lives in the owner API (lib/owner/guards.ts). Content entities
-- (events/resources/announcements/spotlights) archive via their existing status
-- columns, so they need no schema change.

ALTER TABLE metros ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- DOWN:
-- ALTER TABLE metros DROP COLUMN IF EXISTS archived_at;
