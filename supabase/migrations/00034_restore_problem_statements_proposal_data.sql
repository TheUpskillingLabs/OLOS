-- Drift repair: restore problem_statements.proposal_data.
--
-- Migration 00007_add_proposal_data.sql adds this column and is recorded as
-- applied, but the column was observed MISSING on the deployed database (dev).
-- The app reads/writes it in both directions:
--   - POST /api/problem-statements            (Phase 1 submit)
--   - GET  /api/problem-statements/[cycle_id]  (Phase 2 voting page)
-- so a missing column 500s problem-statement submission and voting entirely.
--
-- IF NOT EXISTS makes this a safe no-op where the column is already present and
-- a self-heal where an environment drifted (a fresh `db push` will not re-run
-- 00007 because it is already recorded).

ALTER TABLE problem_statements ADD COLUMN IF NOT EXISTS proposal_data JSONB;
