-- ROADMAP §1.2 / ISSUE-W1-002 — seed `option_lists` per spec
--
-- The six lists ship to production. seed.sql only runs against local DBs, so
-- the rows live here instead. ON CONFLICT (list_name, value) DO NOTHING makes
-- this safely re-runnable on staging/prod and on local resets where the
-- (now-removed) seed.sql block previously inserted the same values.
--
-- display_order increments of 10 leave room for future inserts to slot in
-- without renumbering. Strings are copied verbatim from
-- TUL_MVP_Spec.md §option_lists Seed Data — they render to participants.

INSERT INTO option_lists (list_name, value, display_order) VALUES
  ('ai_tools', 'ChatGPT', 10),
  ('ai_tools', 'Claude', 20),
  ('ai_tools', 'Copilot', 30),
  ('ai_tools', 'Gemini', 40),
  ('ai_tools', 'Midjourney / DALL-E', 50),
  ('ai_tools', 'Perplexity', 60),
  ('ai_tools', 'Other', 70)
ON CONFLICT (list_name, value) DO NOTHING;

INSERT INTO option_lists (list_name, value, display_order) VALUES
  ('labs_goals', 'Build a portfolio project', 10),
  ('labs_goals', 'Learn AI tools in practice', 20),
  ('labs_goals', 'Connect with collaborators', 30),
  ('labs_goals', 'Explore a new career direction', 40),
  ('labs_goals', 'Contribute to community impact', 50),
  ('labs_goals', 'Sharpen technical skills', 60)
ON CONFLICT (list_name, value) DO NOTHING;

INSERT INTO option_lists (list_name, value, display_order) VALUES
  ('availability', '< 2 hrs/week', 10),
  ('availability', '2–5 hrs/week', 20),
  ('availability', '5–10 hrs/week', 30),
  ('availability', '10+ hrs/week', 40)
ON CONFLICT (list_name, value) DO NOTHING;

INSERT INTO option_lists (list_name, value, display_order) VALUES
  ('work_style', 'Independent with check-ins', 10),
  ('work_style', 'Collaborative throughout', 20),
  ('work_style', 'Structured with clear milestones', 30),
  ('work_style', 'Flexible and self-directed', 40)
ON CONFLICT (list_name, value) DO NOTHING;

INSERT INTO option_lists (list_name, value, display_order) VALUES
  ('group_strengths', 'Project management', 10),
  ('group_strengths', 'Technical development', 20),
  ('group_strengths', 'Design / UX', 30),
  ('group_strengths', 'Research', 40),
  ('group_strengths', 'Communication / writing', 50),
  ('group_strengths', 'Community engagement', 60)
ON CONFLICT (list_name, value) DO NOTHING;

INSERT INTO option_lists (list_name, value, display_order) VALUES
  ('pulse_benefits', 'Applied AI tools to a real project', 10),
  ('pulse_benefits', 'Learned a new skill or concept', 20),
  ('pulse_benefits', 'Connected with a new collaborator', 30),
  ('pulse_benefits', 'Received helpful feedback', 40),
  ('pulse_benefits', 'Contributed meaningfully to my pod', 50),
  ('pulse_benefits', 'Overcame a technical challenge', 60)
ON CONFLICT (list_name, value) DO NOTHING;
