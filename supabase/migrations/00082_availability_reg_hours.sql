-- Unify the weekly time-commitment field across cycle registration and the
-- profile onto a single "availability" option list, using the registration
-- form's hour buckets (the join ceremony's HOURS choices).
--
-- Before this, the join ceremony stored the member's hours only on
-- cycle_agreements.answers.hours (free text), while the profile's editable
-- "Availability" field read a separate, differently-bucketed option list that
-- registration never wrote — so a member's registered commitment never showed
-- on their profile. Now: registration writes the pick into participant_options
-- (see app/api/cycles/[cycle_id]/agreement), the profile view/edit read it, and
-- the option list matches the reg form's buckets.
--
-- Existing availability selections are dropped and rebuilt from each member's
-- latest signed agreement — the current data is all test/team accounts, and
-- the reg answer is the intended source of truth anyway.

BEGIN;

-- Drop old availability buckets and any selections referencing them
-- (participant_options.option_id FKs option_lists, so clear children first).
DELETE FROM participant_options
  WHERE option_id IN (SELECT id FROM option_lists WHERE list_name = 'availability');
DELETE FROM option_lists WHERE list_name = 'availability';

-- Re-seed with the registration form's buckets. Values match the join
-- ceremony's HOURS strings exactly (incl. the en-dash and spacing) so a lookup
-- by cycle_agreements.answers.hours resolves to an option id.
INSERT INTO option_lists (list_name, value, display_order, active) VALUES
  ('availability', '2–4 hrs / week', 10, true),
  ('availability', '5–8 hrs / week', 20, true),
  ('availability', '8+ hrs / week', 30, true);

-- Backfill: give each participant the availability option matching their most
-- recent signed agreement's hours, so profiles populate without re-registering.
INSERT INTO participant_options (participant_id, option_id)
SELECT DISTINCT ON (ca.participant_id) ca.participant_id, ol.id
FROM cycle_agreements ca
JOIN option_lists ol
  ON ol.list_name = 'availability' AND ol.value = ca.answers->>'hours'
WHERE ca.answers ? 'hours'
ORDER BY ca.participant_id, ca.signed_at DESC;

COMMIT;
