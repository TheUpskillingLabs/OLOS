-- Seed data for option_lists per TUL_MVP_Spec.md

-- ai_tools
INSERT INTO option_lists (list_name, value, display_order) VALUES
  ('ai_tools', 'ChatGPT', 1),
  ('ai_tools', 'Claude', 2),
  ('ai_tools', 'Copilot', 3),
  ('ai_tools', 'Gemini', 4),
  ('ai_tools', 'Midjourney / DALL-E', 5),
  ('ai_tools', 'Perplexity', 6),
  ('ai_tools', 'Other', 7);

-- labs_goals
INSERT INTO option_lists (list_name, value, display_order) VALUES
  ('labs_goals', 'Build a portfolio project', 1),
  ('labs_goals', 'Learn AI tools in practice', 2),
  ('labs_goals', 'Connect with collaborators', 3),
  ('labs_goals', 'Explore a new career direction', 4),
  ('labs_goals', 'Contribute to community impact', 5),
  ('labs_goals', 'Sharpen technical skills', 6);

-- availability
INSERT INTO option_lists (list_name, value, display_order) VALUES
  ('availability', '< 2 hrs/week', 1),
  ('availability', '2–5 hrs/week', 2),
  ('availability', '5–10 hrs/week', 3),
  ('availability', '10+ hrs/week', 4);

-- work_style
INSERT INTO option_lists (list_name, value, display_order) VALUES
  ('work_style', 'Independent with check-ins', 1),
  ('work_style', 'Collaborative throughout', 2),
  ('work_style', 'Structured with clear milestones', 3),
  ('work_style', 'Flexible and self-directed', 4);

-- group_strengths
INSERT INTO option_lists (list_name, value, display_order) VALUES
  ('group_strengths', 'Project management', 1),
  ('group_strengths', 'Technical development', 2),
  ('group_strengths', 'Design / UX', 3),
  ('group_strengths', 'Research', 4),
  ('group_strengths', 'Communication / writing', 5),
  ('group_strengths', 'Community engagement', 6);

-- pulse_benefits
INSERT INTO option_lists (list_name, value, display_order) VALUES
  ('pulse_benefits', 'Applied AI tools to a real project', 1),
  ('pulse_benefits', 'Learned a new skill or concept', 2),
  ('pulse_benefits', 'Connected with a new collaborator', 3),
  ('pulse_benefits', 'Received helpful feedback', 4),
  ('pulse_benefits', 'Contributed meaningfully to my pod', 5),
  ('pulse_benefits', 'Overcame a technical challenge', 6);
