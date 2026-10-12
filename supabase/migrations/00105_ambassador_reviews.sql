-- 00105_ambassador_reviews.sql
--
-- Two reviewers decide an ambassador application (docs/ambassadors/CLAUDE.md).
-- 00104 let one coordinator confirm or decline alone; the program launches as
-- an application that two people review, each seeing the quiz result, the
-- agreement and the applicant's OLOS record.
--
--   ambassador_reviews — one row per reviewer per review round. Two approvals
--   approve (and grant the role); two declines decline; a 1–1 split waits for
--   an admin's third review, which decides. An invited applicant skips
--   review: the invite is approved by a second coordinator instead (00106) and
--   kept here as a source='invite' row for the record.
--   Reopening a declined application starts a new round: the old rows are
--   kept as history (superseded_at) and stop counting.
--
-- The rules (who may review, independence, the outcome) live in
-- lib/ambassador/review.ts; writes go through the service-role route
-- app/api/ambassadors/applications/[id], which enforces the Lab scope.
-- RLS is the read backstop: admins only. An applicant never reads reviews —
-- reviewer notes are internal.
--
-- Idempotent + re-runnable.
--
-- DOWN:
--   DROP TABLE IF EXISTS ambassador_reviews;

CREATE TABLE IF NOT EXISTS ambassador_reviews (
  id             serial PRIMARY KEY,
  application_id integer NOT NULL REFERENCES ambassador_applications(id) ON DELETE CASCADE,
  -- SET NULL keeps the decision when a reviewer's account is deleted.
  reviewer_id    integer REFERENCES participants(id) ON DELETE SET NULL,
  decision       varchar(10) NOT NULL CHECK (decision IN ('approve','decline')),
  -- For the other reviewers only; never shown to the applicant.
  note           varchar(1000),
  -- 'invite' = recorded from a pre-approved invite on the inviter's behalf.
  source         varchar(10) NOT NULL DEFAULT 'review' CHECK (source IN ('review','invite')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  -- Set when the application is reopened: the row stays as history.
  superseded_at  timestamptz
);

-- One counting review per reviewer per round.
CREATE UNIQUE INDEX IF NOT EXISTS uq_amb_reviews_active
  ON ambassador_reviews (application_id, reviewer_id)
  WHERE superseded_at IS NULL AND reviewer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_amb_reviews_reviewer ON ambassador_reviews (reviewer_id);

ALTER TABLE ambassador_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amb_reviews_select ON ambassador_reviews;
CREATE POLICY amb_reviews_select ON ambassador_reviews FOR SELECT
  USING (is_admin());
