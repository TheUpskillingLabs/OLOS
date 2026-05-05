-- Pulse Check V2
-- Adds nominations table, 7-day enforcement tracking, and refreshes pulse_benefits options.

-- 1. Nominations table
CREATE TABLE nominations (
  id SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  pulse_check_id INT REFERENCES pulse_checks(id) ON DELETE SET NULL,
  cycle_id INT REFERENCES cycles(id),
  nominee_name VARCHAR(255) NOT NULL,
  nominee_email VARCHAR(320),
  nominee_linkedin VARCHAR(500),
  nomination_type VARCHAR(20) NOT NULL CHECK (nomination_type IN ('upskiller', 'mentor', 'advisor')),
  reason TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_nominations_participant ON nominations(participant_id);
CREATE INDEX idx_nominations_cycle ON nominations(cycle_id);
CREATE INDEX idx_nominations_type ON nominations(nomination_type);

ALTER TABLE nominations ENABLE ROW LEVEL SECURITY;

-- SELECT: own, or has participants:read, or moderator of a pod the nominator belongs to
CREATE POLICY "nominations_select" ON nominations FOR SELECT TO authenticated
  USING (
    participant_id = current_participant_id()
    OR has_permission('participants:read')
    OR EXISTS (
      SELECT 1
      FROM pod_memberships pm
      JOIN moderator_assignments ma ON ma.pod_id = pm.pod_id
      JOIN participants mp ON mp.id = ma.participant_id
      WHERE pm.participant_id = nominations.participant_id
        AND mp.auth_user_id = auth.uid()
        AND ma.removed_at IS NULL
        AND pm.inactive_at IS NULL
    )
  );

-- INSERT: only as self
CREATE POLICY "nominations_insert_own" ON nominations FOR INSERT TO authenticated
  WITH CHECK (participant_id = current_participant_id());

-- 2. 7-day enforcement tracking on participants
ALTER TABLE participants ADD COLUMN last_pulse_completed_at TIMESTAMP;

UPDATE participants p
SET last_pulse_completed_at = (
  SELECT MAX(pc.completed_at)
  FROM pulse_checks pc
  WHERE pc.participant_id = p.id AND pc.completed_at IS NOT NULL
);

-- 3. Refresh pulse_benefits option list. Existing values are deactivated (not deleted)
-- so historical pulse_checks.survey_responses references remain valid.
UPDATE option_lists SET active = FALSE WHERE list_name = 'pulse_benefits';

INSERT INTO option_lists (list_name, value, display_order, active) VALUES
  ('pulse_benefits', 'Working on a real project I can show to employers', 1, TRUE),
  ('pulse_benefits', 'Learning alongside peers by doing, not just reading', 2, TRUE),
  ('pulse_benefits', 'Improving how I work using new tools', 3, TRUE),
  ('pulse_benefits', 'Contributing to something that matters beyond myself', 4, TRUE),
  ('pulse_benefits', 'Meeting collaborators and mentors', 5, TRUE),
  ('pulse_benefits', 'Building confidence navigating new technology', 6, TRUE),
  ('pulse_benefits', 'Attending a workshop or office hours session', 7, TRUE)
ON CONFLICT (list_name, value) DO NOTHING;

-- 4. Expand ai_tools options. The original list was minimal; this adds
-- a comprehensive set of common LLMs, coding assistants, image/video tools,
-- and agent platforms that participants are likely to use. ON CONFLICT
-- guards against re-running on databases where seed.sql already inserted
-- these values.
INSERT INTO option_lists (list_name, value, display_order, active) VALUES
  ('ai_tools', 'Claude Code', 10, TRUE),
  ('ai_tools', 'Cursor', 11, TRUE),
  ('ai_tools', 'Windsurf', 12, TRUE),
  ('ai_tools', 'GitHub Copilot', 13, TRUE),
  ('ai_tools', 'Codeium', 14, TRUE),
  ('ai_tools', 'Replit Agent', 15, TRUE),
  ('ai_tools', 'Bolt', 16, TRUE),
  ('ai_tools', 'v0', 17, TRUE),
  ('ai_tools', 'Lovable', 18, TRUE),
  ('ai_tools', 'Devin', 19, TRUE),
  ('ai_tools', 'Aider', 20, TRUE),
  ('ai_tools', 'Cline', 21, TRUE),
  ('ai_tools', 'Anthropic Claude (web/app)', 22, TRUE),
  ('ai_tools', 'OpenAI ChatGPT', 23, TRUE),
  ('ai_tools', 'Google Gemini', 24, TRUE),
  ('ai_tools', 'Microsoft Copilot', 25, TRUE),
  ('ai_tools', 'Perplexity', 26, TRUE),
  ('ai_tools', 'Mistral / Le Chat', 27, TRUE),
  ('ai_tools', 'Grok', 28, TRUE),
  ('ai_tools', 'DeepSeek', 29, TRUE),
  ('ai_tools', 'Llama (local)', 30, TRUE),
  ('ai_tools', 'Ollama', 31, TRUE),
  ('ai_tools', 'LM Studio', 32, TRUE),
  ('ai_tools', 'NotebookLM', 33, TRUE),
  ('ai_tools', 'Midjourney', 34, TRUE),
  ('ai_tools', 'DALL-E', 35, TRUE),
  ('ai_tools', 'Stable Diffusion', 36, TRUE),
  ('ai_tools', 'Flux', 37, TRUE),
  ('ai_tools', 'Ideogram', 38, TRUE),
  ('ai_tools', 'Runway', 39, TRUE),
  ('ai_tools', 'Sora', 40, TRUE),
  ('ai_tools', 'Veo', 41, TRUE),
  ('ai_tools', 'Pika', 42, TRUE),
  ('ai_tools', 'Luma Dream Machine', 43, TRUE),
  ('ai_tools', 'ElevenLabs', 44, TRUE),
  ('ai_tools', 'Suno', 45, TRUE),
  ('ai_tools', 'Udio', 46, TRUE),
  ('ai_tools', 'HeyGen', 47, TRUE),
  ('ai_tools', 'Descript', 48, TRUE),
  ('ai_tools', 'Otter.ai', 49, TRUE),
  ('ai_tools', 'Granola', 50, TRUE),
  ('ai_tools', 'Fathom', 51, TRUE),
  ('ai_tools', 'Read.ai', 52, TRUE),
  ('ai_tools', 'Notion AI', 53, TRUE),
  ('ai_tools', 'Gamma', 54, TRUE),
  ('ai_tools', 'Tome', 55, TRUE),
  ('ai_tools', 'Canva AI / Magic Studio', 56, TRUE),
  ('ai_tools', 'Adobe Firefly', 57, TRUE),
  ('ai_tools', 'Figma AI', 58, TRUE),
  ('ai_tools', 'Framer AI', 59, TRUE),
  ('ai_tools', 'Zapier AI', 60, TRUE),
  ('ai_tools', 'n8n', 61, TRUE),
  ('ai_tools', 'Make', 62, TRUE),
  ('ai_tools', 'LangChain / LangGraph', 63, TRUE),
  ('ai_tools', 'LlamaIndex', 64, TRUE),
  ('ai_tools', 'Hugging Face', 65, TRUE),
  ('ai_tools', 'Replicate', 66, TRUE),
  ('ai_tools', 'OpenRouter', 67, TRUE),
  ('ai_tools', 'Vercel AI SDK', 68, TRUE),
  ('ai_tools', 'Pinecone', 69, TRUE),
  ('ai_tools', 'Supabase Vector', 70, TRUE)
ON CONFLICT (list_name, value) DO NOTHING;
