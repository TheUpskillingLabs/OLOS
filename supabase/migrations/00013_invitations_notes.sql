-- Add notes column to invitations table
-- Used by the bulk magic link invite flow to surface per-row messaging to admins
-- (e.g. "Name not found in participants", "Already logged in", "Magic link sent")

ALTER TABLE invitations ADD COLUMN notes TEXT;
