-- ROADMAP §1.2 / ISSUE-W1-002 — seed `option_lists` per spec (remaining 4 lists)
--
-- Scope note: 00010_pulse_check_v2.sql already shipped `ai_tools` (61 rows,
-- expanded for autocomplete) and `pulse_benefits` (7 rows, reworded for Labs
-- value-prop alignment) to staging/prod, deliberately superseding the
-- TUL_MVP_Spec.md values for those two lists. This migration covers only
-- the four lists 00010 didn't touch — the spec-aligned ones.
--
-- ON CONFLICT (list_name, value) DO NOTHING makes this safe to re-run on
-- staging/prod and on local resets where seed.sql previously inserted the
-- same values (now removed from seed.sql to avoid the unique-constraint
-- collision).
--
-- display_order increments of 10 leave room for future inserts to slot in
-- without renumbering. Strings are copied verbatim from
-- TUL_MVP_Spec.md §option_lists Seed Data.

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
