-- Add quarterly cycle phase milestone columns to cycle_config.
-- Phase 1 runs from cycles.start_date → phase_2_start ("Meet The Pods").
-- Phase 2 runs from phase_2_start → phase_3_start ("Meet The Projects").
-- Phase 3 runs from phase_3_start → cycles.end_date ("Demo Day / Showcase / Summit").

ALTER TABLE cycle_config
  ADD COLUMN phase_2_start TIMESTAMP,
  ADD COLUMN phase_3_start TIMESTAMP;
