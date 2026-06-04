-- In-app feedback widget (floating launcher + dialog; see app/components/feedback/).
--
-- Lets any signed-in user report a problem from anywhere in the dashboard and
-- optionally attach screenshots. Two tables:
--   feedback              — one row per submission (category + free text + context)
--   feedback_attachments  — zero-or-more image references per submission
--
-- Images live in the private 'feedback-attachments' storage bucket (created
-- below). The API route uploads via the service client, so storage objects
-- need no per-row RLS; admins fetch them later via signed URLs.

CREATE TABLE feedback (
  id              SERIAL PRIMARY KEY,
  auth_user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_id  INT REFERENCES participants(id) ON DELETE SET NULL,
  category        TEXT NOT NULL CHECK (category IN ('bug', 'suggestion', 'other')),
  description     TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 5000),
  page_url        TEXT,
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'in_review', 'resolved', 'closed')),
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_feedback_author ON feedback (auth_user_id);
CREATE INDEX idx_feedback_status ON feedback (status, created_at DESC);

CREATE TABLE feedback_attachments (
  id            SERIAL PRIMARY KEY,
  feedback_id   INT NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,
  mime_type     TEXT,
  size_bytes    INT,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_feedback_attachments_feedback ON feedback_attachments (feedback_id);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_attachments ENABLE ROW LEVEL SECURITY;

-- feedback: authors read their own; admins/owners read everything.
CREATE POLICY "feedback_select" ON feedback FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR is_admin_or_owner());

-- INSERT only as yourself (the API sets auth_user_id from the session).
CREATE POLICY "feedback_insert" ON feedback FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

-- UPDATE (status triage) is admin/owner only.
CREATE POLICY "feedback_update" ON feedback FOR UPDATE TO authenticated
  USING (is_admin_or_owner());

-- attachments: visible to whoever can see the parent feedback row. Inserts are
-- performed by the API via the service client (bypasses RLS), so no INSERT
-- policy is granted to authenticated users.
CREATE POLICY "feedback_attachments_select" ON feedback_attachments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM feedback f
      WHERE f.id = feedback_attachments.feedback_id
        AND (f.auth_user_id = auth.uid() OR is_admin_or_owner())
    )
  );

-- Private bucket for screenshots. Objects are served to admins via signed URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-attachments', 'feedback-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- DOWN (manual rollback — forward-only repo policy):
-- DELETE FROM storage.buckets WHERE id = 'feedback-attachments';
-- DROP POLICY IF EXISTS "feedback_attachments_select" ON feedback_attachments;
-- DROP POLICY IF EXISTS "feedback_update" ON feedback;
-- DROP POLICY IF EXISTS "feedback_insert" ON feedback;
-- DROP POLICY IF EXISTS "feedback_select" ON feedback;
-- DROP TABLE IF EXISTS feedback_attachments;
-- DROP TABLE IF EXISTS feedback;
