-- Make pulse checks available without an active cycle.
-- cycle_id becomes nullable: NULL means a standalone / personal reflection entry.

ALTER TABLE pulse_checks ALTER COLUMN cycle_id DROP NOT NULL;

-- Standalone entries: at most one per participant per day
CREATE UNIQUE INDEX idx_pulse_checks_standalone_unique
  ON pulse_checks (participant_id, scheduled_date)
  WHERE cycle_id IS NULL;

-- Fast lookup for standalone history
CREATE INDEX idx_pulse_checks_standalone
  ON pulse_checks (participant_id, scheduled_date DESC)
  WHERE cycle_id IS NULL;
