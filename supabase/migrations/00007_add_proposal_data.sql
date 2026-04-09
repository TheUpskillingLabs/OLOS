-- Add structured proposal data column to problem_statements
-- Stores the full multi-part proposal form data (about, problem breakdown,
-- voter context, etc.) alongside the composed statement_text.
ALTER TABLE problem_statements
  ADD COLUMN proposal_data JSONB;
