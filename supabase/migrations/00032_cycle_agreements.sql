-- The Open Cycle Agreement (onboarding-proto port, stage C1; backend doc §2c).
--
-- Registration has gravity (owner decision): the typed full name + timestamp
-- + agreement version IS the signature, and enrollment is not complete
-- without it. One table, insert-only.
--
-- §3.7-safe by construction: enrollment ACTIVATION reads this table as a
-- precondition inside reconcileEnrollmentActivation — the agreement path
-- never activates cycle_enrollments. (The ceremony's endpoint may create the
-- initial status='inactive' interest row, exactly as /api/cycles/[id]/interest
-- does; activation stays exclusively with the reconciler.)
--
-- The answers column carries the ceremony's four registration questions
-- (problem area / level / goals / hours) — the prototype's cycle flow.
-- Owner decision D2.6 (field disposition vs the old long intake) is pending;
-- keeping them JSONB preserves the data either way.

CREATE TABLE IF NOT EXISTS cycle_agreements (
  id SERIAL PRIMARY KEY,
  participant_id INTEGER NOT NULL REFERENCES participants(id),
  cycle_id INTEGER NOT NULL REFERENCES cycles(id),
  agreement_version VARCHAR(50) NOT NULL,
  signature_name TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answers JSONB,
  UNIQUE (participant_id, cycle_id)
);

-- RLS: members read their own signature (it surfaces on the profile and in
-- the Poderator member drawer via service-role queries); all writes go
-- through the service-role client in the API route — no INSERT/UPDATE/DELETE
-- policies on purpose, and no UPDATE path exists (insert-only).
ALTER TABLE cycle_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cycle_agreements_select_own ON cycle_agreements;
CREATE POLICY cycle_agreements_select_own ON cycle_agreements
  FOR SELECT USING (
    participant_id IN (
      SELECT id FROM participants WHERE auth_user_id = auth.uid()
    )
  );

-- DOWN: rollback block. Copy into a scratch query to revert in dev.
-- Not auto-applied; Supabase migrations are forward-only.
--
-- DROP TABLE IF EXISTS cycle_agreements;
