-- Seed data for OLOS / The Upskilling Labs
BEGIN;

-- ai_tools (comprehensive list — used as autocomplete suggestions in the
-- pulse-check form; participants can also add their own tags as free text)
INSERT INTO option_lists (list_name, value, display_order) VALUES
  ('ai_tools', 'Claude Code', 1),
  ('ai_tools', 'Cursor', 2),
  ('ai_tools', 'Windsurf', 3),
  ('ai_tools', 'GitHub Copilot', 4),
  ('ai_tools', 'Codeium', 5),
  ('ai_tools', 'Replit Agent', 6),
  ('ai_tools', 'Bolt', 7),
  ('ai_tools', 'v0', 8),
  ('ai_tools', 'Lovable', 9),
  ('ai_tools', 'Devin', 10),
  ('ai_tools', 'Aider', 11),
  ('ai_tools', 'Cline', 12),
  ('ai_tools', 'Anthropic Claude (web/app)', 13),
  ('ai_tools', 'OpenAI ChatGPT', 14),
  ('ai_tools', 'Google Gemini', 15),
  ('ai_tools', 'Microsoft Copilot', 16),
  ('ai_tools', 'Perplexity', 17),
  ('ai_tools', 'Mistral / Le Chat', 18),
  ('ai_tools', 'Grok', 19),
  ('ai_tools', 'DeepSeek', 20),
  ('ai_tools', 'Llama (local)', 21),
  ('ai_tools', 'Ollama', 22),
  ('ai_tools', 'LM Studio', 23),
  ('ai_tools', 'NotebookLM', 24),
  ('ai_tools', 'Midjourney', 25),
  ('ai_tools', 'DALL-E', 26),
  ('ai_tools', 'Stable Diffusion', 27),
  ('ai_tools', 'Flux', 28),
  ('ai_tools', 'Ideogram', 29),
  ('ai_tools', 'Runway', 30),
  ('ai_tools', 'Sora', 31),
  ('ai_tools', 'Veo', 32),
  ('ai_tools', 'Pika', 33),
  ('ai_tools', 'Luma Dream Machine', 34),
  ('ai_tools', 'ElevenLabs', 35),
  ('ai_tools', 'Suno', 36),
  ('ai_tools', 'Udio', 37),
  ('ai_tools', 'HeyGen', 38),
  ('ai_tools', 'Descript', 39),
  ('ai_tools', 'Otter.ai', 40),
  ('ai_tools', 'Granola', 41),
  ('ai_tools', 'Fathom', 42),
  ('ai_tools', 'Read.ai', 43),
  ('ai_tools', 'Notion AI', 44),
  ('ai_tools', 'Gamma', 45),
  ('ai_tools', 'Tome', 46),
  ('ai_tools', 'Canva AI / Magic Studio', 47),
  ('ai_tools', 'Adobe Firefly', 48),
  ('ai_tools', 'Figma AI', 49),
  ('ai_tools', 'Framer AI', 50),
  ('ai_tools', 'Zapier AI', 51),
  ('ai_tools', 'n8n', 52),
  ('ai_tools', 'Make', 53),
  ('ai_tools', 'LangChain / LangGraph', 54),
  ('ai_tools', 'LlamaIndex', 55),
  ('ai_tools', 'Hugging Face', 56),
  ('ai_tools', 'Replicate', 57),
  ('ai_tools', 'OpenRouter', 58),
  ('ai_tools', 'Vercel AI SDK', 59),
  ('ai_tools', 'Pinecone', 60),
  ('ai_tools', 'Supabase Vector', 61)
ON CONFLICT (list_name, value) DO NOTHING;

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

-- pulse_benefits (V2 — Labs value-prop aligned)
-- Old values kept for reference (deactivated in migration 00010):
--   ('pulse_benefits', 'Applied AI tools to a real project', 1),
--   ('pulse_benefits', 'Learned a new skill or concept', 2),
--   ('pulse_benefits', 'Connected with a new collaborator', 3),
--   ('pulse_benefits', 'Received helpful feedback', 4),
--   ('pulse_benefits', 'Contributed meaningfully to my pod', 5),
--   ('pulse_benefits', 'Overcame a technical challenge', 6);
INSERT INTO option_lists (list_name, value, display_order) VALUES
  ('pulse_benefits', 'Working on a real project I can show to employers', 1),
  ('pulse_benefits', 'Learning alongside peers by doing, not just reading', 2),
  ('pulse_benefits', 'Improving how I work using new tools', 3),
  ('pulse_benefits', 'Contributing to something that matters beyond myself', 4),
  ('pulse_benefits', 'Meeting collaborators and mentors', 5),
  ('pulse_benefits', 'Building confidence navigating new technology', 6),
  ('pulse_benefits', 'Attending a workshop or office hours session', 7)
ON CONFLICT (list_name, value) DO NOTHING;

-- =============================================
-- Cycle Dummy Data for Testing
-- =============================================

-- 1. Cycle
INSERT INTO cycles (id, name, slug, start_date, end_date, status) VALUES
  (1, 'Spring 2026 Build Cycle', 'spring-2026', '2026-03-16 00:00:00', '2026-06-08 23:59:59', 'active');

-- 2. Cycle Config
INSERT INTO cycle_config (
  id, cycle_id,
  submitter_votes, non_submitter_votes, vote_threshold, max_pods, pod_min,
  project_submitter_votes, project_vote_threshold, max_projects,
  project_min, project_max,
  problem_statement_open, problem_statement_close,
  voting_open, voting_close,
  pod_registration_open, pod_registration_close,
  solution_proposal_open, solution_proposal_close,
  solution_voting_open, solution_voting_close,
  project_registration_open, project_registration_close,
  phase_2_start, phase_3_start
) VALUES (
  1, 1,
  3, 1, 5, 8, 5,
  3, 5, 8,
  3, 7,
  '2026-03-16 09:00:00', '2026-03-23 23:59:59',
  '2026-03-24 09:00:00', '2026-03-28 23:59:59',
  '2026-03-29 09:00:00', '2026-04-02 23:59:59',
  '2026-04-03 09:00:00', '2026-04-07 23:59:59',
  '2026-04-08 09:00:00', '2026-04-10 23:59:59',
  '2026-04-11 09:00:00', '2026-04-16 23:59:59',
  '2026-04-13 00:00:00', '2026-05-11 00:00:00'
);

-- 3. Participants (20 DC-area profiles)
INSERT INTO participants (
  id, auth_user_id, google_id, email,
  first_name, last_name, preferred_name, gender,
  state, neighborhood,
  dcpl_card, dcpl_info,
  work_situation, main_focus, sector, current_title, linkedin,
  ai_tool_familiarity,
  participation_commitment, primary_expertise, volunteer_interest,
  text_updates, photo_video_consent, source,
  slack_username, github_username, drive_email
) VALUES
  (1, NULL, 'google_dummy_1', 'maya.johnson@example.com',
   'Maya', 'Johnson', 'Maya', 'Female',
   'DC', 'Shaw',
   'yes', TRUE,
   'employed full time', 'upskilling in current field', 'Nonprofit', 'Program Director', 'https://linkedin.com/in/mayajohnson',
   4,
   'yes', 'Program management and community organizing', 'Mentoring participants',
   TRUE, TRUE, 'DCPL event',
   'maya.j', 'mayajohnson', 'maya.johnson@example.com'),

  (2, NULL, 'google_dummy_2', 'david.chen@example.com',
   'David', 'Chen', NULL, 'Male',
   'DC', 'Dupont Circle',
   'yes', FALSE,
   'self-employed', 'building a portfolio', 'Technology', 'Tech Consultant', 'https://linkedin.com/in/davidchen',
   5,
   'yes', 'Full-stack development and AI integration', 'Technical mentoring',
   TRUE, TRUE, 'LinkedIn',
   'david.c', 'dchen', 'david.chen@example.com'),

  (3, NULL, 'google_dummy_3', 'aisha.williams@example.com',
   'Aisha', 'Williams', 'Aisha', 'Female',
   'DC', 'Columbia Heights',
   'yes', TRUE,
   'in a career transition', 'exploring new directions', 'Government', 'Former Policy Analyst', 'https://linkedin.com/in/aishawilliams',
   2,
   'yes', 'Policy analysis and research', NULL,
   TRUE, TRUE, 'word of mouth',
   'aisha.w', 'aishawilliams', 'aisha.williams@example.com'),

  (4, NULL, 'google_dummy_4', 'carlos.rivera@example.com',
   'Carlos', 'Rivera', NULL, 'Male',
   'MD', 'Silver Spring',
   'no', FALSE,
   'employed full time', 'upskilling in current field', 'Technology', 'Software Engineer', 'https://linkedin.com/in/carlosrivera',
   4,
   'yes', 'Backend development and cloud architecture', 'Code reviews',
   FALSE, TRUE, 'Meetup',
   'carlos.r', 'crivera', 'carlos.rivera@example.com'),

  (5, NULL, 'google_dummy_5', 'sarah.kim@example.com',
   'Sarah', 'Kim', NULL, 'Female',
   'DC', 'Capitol Hill',
   'yes', TRUE,
   'employed part-time', 'building a portfolio', 'Design', 'UX Researcher', 'https://linkedin.com/in/sarahkim',
   3,
   'yes', 'User research and design thinking', 'Workshop facilitation',
   TRUE, TRUE, 'friend referral',
   'sarah.k', 'sarahkim', 'sarah.kim@example.com'),

  (6, NULL, 'google_dummy_6', 'james.thompson@example.com',
   'James', 'Thompson', 'JT', 'Male',
   'VA', 'Arlington',
   'not sure', FALSE,
   'employed full time', 'upskilling in current field', 'Technology', 'Data Scientist', 'https://linkedin.com/in/jamesthompson',
   5,
   'yes', 'Machine learning and data analysis', NULL,
   FALSE, TRUE, 'LinkedIn',
   'james.t', 'jthompson', 'james.thompson@example.com'),

  (7, NULL, 'google_dummy_7', 'priya.patel@example.com',
   'Priya', 'Patel', NULL, 'Female',
   'DC', 'Petworth',
   'yes', TRUE,
   'student', 'finding a new role', 'Education', 'Graduate Student', NULL,
   3,
   'yes', 'Data visualization and statistics', 'Note-taking and documentation',
   TRUE, TRUE, 'DCPL event',
   'priya.p', 'priyapatel', 'priya.patel@example.com'),

  (8, NULL, 'google_dummy_8', 'marcus.brown@example.com',
   'Marcus', 'Brown', NULL, 'Male',
   'DC', 'Anacostia',
   'yes', TRUE,
   'unemployed and jobseeking', 'finding a new role', 'Marketing', 'Marketing Specialist', 'https://linkedin.com/in/marcusbrown',
   2,
   'yes', 'Digital marketing and content creation', NULL,
   TRUE, TRUE, 'DCPL event',
   'marcus.b', 'marcusbrown', 'marcus.brown@example.com'),

  (9, NULL, 'google_dummy_9', 'elena.gonzalez@example.com',
   'Elena', 'Gonzalez', NULL, 'Female',
   'DC', 'Navy Yard',
   'yes', FALSE,
   'self-employed', 'starting something new', 'Design', 'Freelance Designer', 'https://linkedin.com/in/elenagonzalez',
   3,
   'yes', 'Visual design and branding', 'Design support',
   TRUE, TRUE, 'Twitter',
   'elena.g', 'elenag', 'elena.gonzalez@example.com'),

  (10, NULL, 'google_dummy_10', 'michael.obrien@example.com',
   'Michael', 'O''Brien', 'Mike', 'Male',
   'MD', 'Bethesda',
   'not sure', FALSE,
   'employed full time', 'building a portfolio', 'Consulting', 'Project Manager', 'https://linkedin.com/in/michaelobrien',
   3,
   'yes', 'Project management and agile methodology', 'Scrum facilitation',
   FALSE, TRUE, 'word of mouth',
   'mike.ob', 'mikeobrien', 'michael.obrien@example.com'),

  (11, NULL, 'google_dummy_11', 'fatima.hassan@example.com',
   'Fatima', 'Hassan', NULL, 'Female',
   'DC', 'Brookland',
   'yes', TRUE,
   'in a career transition', 'exploring new directions', 'Education', 'Former Teacher', NULL,
   1,
   'uncertain', 'Curriculum development and pedagogy', NULL,
   TRUE, TRUE, 'DCPL event',
   NULL, NULL, NULL),

  (12, NULL, 'google_dummy_12', 'tyler.washington@example.com',
   'Tyler', 'Washington', 'Ty', 'Male',
   'DC', 'U Street',
   'yes', FALSE,
   'employed full time', 'upskilling in current field', 'Technology', 'Backend Developer', 'https://linkedin.com/in/tylerwashington',
   4,
   'yes', 'Python and API development', 'Code pairing',
   TRUE, TRUE, 'Meetup',
   'tyler.w', 'tylerwash', 'tyler.washington@example.com'),

  (13, NULL, 'google_dummy_13', 'jen.liu@example.com',
   'Jennifer', 'Liu', 'Jen', 'Female',
   'DC', 'Georgetown',
   'yes', TRUE,
   'employed part-time', 'building a portfolio', 'Media', 'Content Strategist', 'https://linkedin.com/in/jenliu',
   2,
   'yes', 'Content strategy and copywriting', 'Writing and editing',
   TRUE, TRUE, 'friend referral',
   'jen.l', 'jenliu', 'jen.liu@example.com'),

  (14, NULL, 'google_dummy_14', 'andre.jackson@example.com',
   'Andre', 'Jackson', 'Dre', 'Male',
   'MD', 'College Park',
   'no', FALSE,
   'student', 'finding a new role', 'Technology', 'CS Undergraduate', NULL,
   3,
   'yes', 'Web development and React', NULL,
   TRUE, TRUE, 'word of mouth',
   'andre.j', 'andrejackson', 'andre.jackson@example.com'),

  (15, NULL, 'google_dummy_15', 'rachel.goldstein@example.com',
   'Rachel', 'Goldstein', NULL, 'Female',
   'DC', 'Adams Morgan',
   'yes', TRUE,
   'self-employed', 'upskilling in current field', 'Data', 'Data Analyst', 'https://linkedin.com/in/rachelgoldstein',
   4,
   'yes', 'SQL and data visualization', 'Data analysis support',
   FALSE, TRUE, 'LinkedIn',
   'rachel.g', 'rachelg', 'rachel.goldstein@example.com'),

  (16, NULL, 'google_dummy_16', 'kwame.mensah@example.com',
   'Kwame', 'Mensah', NULL, 'Male',
   'DC', 'Brightwood',
   'yes', TRUE,
   'employed full time', 'upskilling in current field', 'Nonprofit', 'Nonprofit Manager', 'https://linkedin.com/in/kwamemensah',
   2,
   'yes', 'Program evaluation and grant writing', 'Community outreach',
   TRUE, TRUE, 'DCPL event',
   'kwame.m', 'kwamem', 'kwame.mensah@example.com'),

  (17, NULL, 'google_dummy_17', 'lisa.nguyen@example.com',
   'Lisa', 'Nguyen', NULL, 'Female',
   'VA', 'Alexandria',
   'no', FALSE,
   'employed full time', 'exploring new directions', 'Healthcare', 'Healthcare Admin', 'https://linkedin.com/in/lisanguyen',
   2,
   'yes', 'Healthcare operations and compliance', NULL,
   FALSE, TRUE, 'LinkedIn',
   'lisa.n', 'lisanguyen', 'lisa.nguyen@example.com'),

  (18, NULL, 'google_dummy_18', 'robert.taylor@example.com',
   'Robert', 'Taylor', 'Rob', 'Male',
   'MD', 'Takoma Park',
   'not sure', FALSE,
   'prefer not to say', 'n/a', NULL, NULL, NULL,
   1,
   'uncertain', NULL, NULL,
   FALSE, FALSE, 'word of mouth',
   NULL, NULL, NULL),

  (19, NULL, 'google_dummy_19', 'diana.reyes@example.com',
   'Diana', 'Reyes', NULL, 'Female',
   'DC', 'Woodley Park',
   'yes', TRUE,
   'in a career transition', 'exploring new directions', 'Government', 'Career Counselor', 'https://linkedin.com/in/dianareyes',
   2,
   'yes', 'Career counseling and advising', NULL,
   TRUE, TRUE, 'friend referral',
   NULL, NULL, NULL),

  (20, NULL, 'google_dummy_20', 'sam.mitchell@example.com',
   'Sam', 'Mitchell', NULL, 'Male',
   'MD', 'Hyattsville',
   'no', FALSE,
   'employed full time', 'upskilling in current field', 'Government', 'Government Analyst', 'https://linkedin.com/in/sammitchell',
   3,
   'yes', 'Data analysis and policy research', NULL,
   TRUE, TRUE, 'Meetup',
   NULL, NULL, NULL);

-- 4. Participant Options (link participants to option_lists)
-- option_lists IDs: ai_tools 1-7, labs_goals 8-13, availability 14-17, work_style 18-21, group_strengths 22-27
INSERT INTO participant_options (participant_id, option_id) VALUES
  -- Participant 1 (Maya): ChatGPT, Claude; Build portfolio, Community impact; 5-10 hrs; Collaborative; Project mgmt, Community engagement
  (1, 1), (1, 2), (1, 8), (1, 12), (1, 16), (1, 19), (1, 22), (1, 27),
  -- Participant 2 (David): ChatGPT, Claude, Copilot; Learn AI, Sharpen skills; 10+ hrs; Independent; Technical dev
  (2, 1), (2, 2), (2, 3), (2, 9), (2, 13), (2, 17), (2, 18), (2, 23),
  -- Participant 3 (Aisha): ChatGPT, Perplexity; Explore career, Community impact; 2-5 hrs; Structured; Research, Communication
  (3, 1), (3, 6), (3, 11), (3, 12), (3, 15), (3, 20), (3, 25), (3, 26),
  -- Participant 4 (Carlos): Copilot, Claude, Gemini; Sharpen skills; 5-10 hrs; Independent; Technical dev
  (4, 3), (4, 2), (4, 4), (4, 13), (4, 16), (4, 18), (4, 23),
  -- Participant 5 (Sarah): ChatGPT, Midjourney; Build portfolio, Connect; 2-5 hrs; Collaborative; Design/UX
  (5, 1), (5, 5), (5, 8), (5, 10), (5, 15), (5, 19), (5, 24),
  -- Participant 6 (James): Claude, Copilot, Gemini; Sharpen skills, Learn AI; 10+ hrs; Flexible; Technical dev, Research
  (6, 2), (6, 3), (6, 4), (6, 13), (6, 9), (6, 17), (6, 21), (6, 23), (6, 25),
  -- Participant 7 (Priya): ChatGPT, Perplexity; Find role, Build portfolio; 5-10 hrs; Structured; Research
  (7, 1), (7, 6), (7, 8), (7, 11), (7, 16), (7, 20), (7, 25),
  -- Participant 8 (Marcus): ChatGPT; Find role, Learn AI; 2-5 hrs; Collaborative; Communication
  (8, 1), (8, 8), (8, 9), (8, 15), (8, 19), (8, 26),
  -- Participant 9 (Elena): Midjourney, ChatGPT; Start something new, Build portfolio; 5-10 hrs; Flexible; Design/UX
  (9, 5), (9, 1), (9, 8), (9, 12), (9, 16), (9, 21), (9, 24),
  -- Participant 10 (Michael): ChatGPT, Gemini; Build portfolio, Connect; 2-5 hrs; Structured; Project mgmt
  (10, 1), (10, 4), (10, 8), (10, 10), (10, 15), (10, 20), (10, 22),
  -- Participant 11 (Fatima): ChatGPT; Explore career; < 2 hrs; Collaborative; Communication, Community engagement
  (11, 1), (11, 11), (11, 14), (11, 19), (11, 26), (11, 27),
  -- Participant 12 (Tyler): Claude, Copilot; Sharpen skills; 10+ hrs; Independent; Technical dev
  (12, 2), (12, 3), (12, 13), (12, 17), (12, 18), (12, 23),
  -- Participant 13 (Jen): ChatGPT, Perplexity; Build portfolio, Connect; 2-5 hrs; Collaborative; Communication, Design/UX
  (13, 1), (13, 6), (13, 8), (13, 10), (13, 15), (13, 19), (13, 26), (13, 24),
  -- Participant 14 (Andre): Copilot, ChatGPT; Find role, Sharpen skills; 5-10 hrs; Flexible; Technical dev
  (14, 3), (14, 1), (14, 8), (14, 13), (14, 16), (14, 21), (14, 23),
  -- Participant 15 (Rachel): Claude, ChatGPT; Learn AI, Sharpen skills; 5-10 hrs; Independent; Research, Technical dev
  (15, 2), (15, 1), (15, 9), (15, 13), (15, 16), (15, 18), (15, 25), (15, 23),
  -- Participant 16 (Kwame): ChatGPT; Community impact, Connect; 2-5 hrs; Structured; Project mgmt, Community engagement
  (16, 1), (16, 12), (16, 10), (16, 15), (16, 20), (16, 22), (16, 27),
  -- Participant 17 (Lisa): ChatGPT, Gemini; Explore career; < 2 hrs; Structured; Research
  (17, 1), (17, 4), (17, 11), (17, 14), (17, 20), (17, 25),
  -- Participant 18 (Robert): Other; n/a; < 2 hrs; Independent
  (18, 7), (18, 14), (18, 18),
  -- Participant 19 (Diana): ChatGPT; Explore career, Connect; 2-5 hrs; Collaborative; Communication
  (19, 1), (19, 11), (19, 10), (19, 15), (19, 19), (19, 26),
  -- Participant 20 (Sam): ChatGPT, Gemini; Upskilling; 2-5 hrs; Structured; Research, Project mgmt
  (20, 1), (20, 4), (20, 13), (20, 15), (20, 20), (20, 25), (20, 22);

-- 5. Cycle Enrollments (all 20 in cycle 1)
INSERT INTO cycle_enrollments (id, participant_id, cycle_id, enrolled_at, status, inactive_date) VALUES
  (1,  1,  1, '2026-03-10 10:00:00', 'active', NULL),
  (2,  2,  1, '2026-03-10 11:30:00', 'active', NULL),
  (3,  3,  1, '2026-03-11 09:15:00', 'active', NULL),
  (4,  4,  1, '2026-03-11 14:00:00', 'active', NULL),
  (5,  5,  1, '2026-03-12 08:45:00', 'active', NULL),
  (6,  6,  1, '2026-03-12 10:30:00', 'active', NULL),
  (7,  7,  1, '2026-03-12 16:00:00', 'active', NULL),
  (8,  8,  1, '2026-03-13 09:00:00', 'active', NULL),
  (9,  9,  1, '2026-03-13 11:00:00', 'active', NULL),
  (10, 10, 1, '2026-03-13 15:30:00', 'active', NULL),
  (11, 11, 1, '2026-03-14 09:00:00', 'active', NULL),
  (12, 12, 1, '2026-03-14 10:00:00', 'active', NULL),
  (13, 13, 1, '2026-03-14 12:30:00', 'active', NULL),
  (14, 14, 1, '2026-03-14 14:00:00', 'active', NULL),
  (15, 15, 1, '2026-03-15 08:00:00', 'active', NULL),
  (16, 16, 1, '2026-03-15 09:30:00', 'active', NULL),
  (17, 17, 1, '2026-03-15 11:00:00', 'active', NULL),
  (18, 18, 1, '2026-03-15 14:00:00', 'revoked',  '2026-04-01 10:00:00'),
  (19, 19, 1, '2026-03-15 16:00:00', 'inactive', '2026-04-03 09:00:00'),
  (20, 20, 1, '2026-03-16 08:00:00', 'inactive', '2026-04-05 12:00:00');

-- 6. User Roles
INSERT INTO user_roles (id, participant_id, role, granted_by, granted_at) VALUES
  (1, 1, 'owner', NULL, '2026-03-01 00:00:00'),
  (2, 2, 'admin', 1,    '2026-03-05 10:00:00');

-- 7. Problem Statements (8 from participants 3-10)
INSERT INTO problem_statements (id, cycle_id, participant_id, statement_text, created_at) VALUES
  (1, 1, 3,  'How might we use AI to help DC residents navigate government services more efficiently?', '2026-03-17 10:30:00'),
  (2, 1, 4,  'How might we build tools that help small businesses in underserved DC neighborhoods leverage AI for marketing?', '2026-03-17 14:00:00'),
  (3, 1, 5,  'How might we create an AI-powered platform to match volunteers with community organizations in the DMV?', '2026-03-18 09:15:00'),
  (4, 1, 6,  'How might we develop AI literacy workshops tailored to seniors in the DC library system?', '2026-03-18 11:00:00'),
  (5, 1, 7,  'How might we use machine learning to analyze and visualize DC open budget data for citizen advocacy?', '2026-03-19 08:45:00'),
  (6, 1, 8,  'How might we build an AI assistant that helps career-changers in the DMV area find relevant upskilling resources?', '2026-03-19 13:30:00'),
  (7, 1, 9,  'How might we create tools that use NLP to improve accessibility of DC Council legislation for everyday residents?', '2026-03-20 10:00:00'),
  (8, 1, 10, 'How might we develop an AI-driven platform to coordinate mutual aid efforts across DC neighborhoods?', '2026-03-20 15:00:00');

-- 8. Votes
-- Submitters (participants 3-10) get up to 3 votes each; non-submitters get 1 vote each
-- Top 3 statements (1,2,3) cross the vote_threshold of 5
INSERT INTO votes (id, cycle_id, voter_id, problem_statement_id, vote_count, created_at) VALUES
  -- Votes for statement 1 (GovNavigate) - total weight: 10
  (1,  1, 3,  1, 3, '2026-03-25 09:00:00'),  -- submitter self-vote
  (2,  1, 4,  1, 1, '2026-03-25 09:30:00'),   -- submitter cross-vote
  (3,  1, 6,  1, 2, '2026-03-25 10:00:00'),
  (4,  1, 1,  1, 1, '2026-03-25 10:30:00'),   -- non-submitter
  (5,  1, 11, 1, 1, '2026-03-25 11:00:00'),
  (6,  1, 12, 1, 1, '2026-03-25 11:30:00'),
  (7,  1, 16, 1, 1, '2026-03-25 12:00:00'),

  -- Votes for statement 2 (SmallBiz AI) - total weight: 9
  (8,  1, 4,  2, 2, '2026-03-25 09:15:00'),   -- submitter self-vote
  (9,  1, 8,  2, 1, '2026-03-25 10:00:00'),
  (10, 1, 5,  2, 1, '2026-03-25 10:30:00'),
  (11, 1, 2,  2, 1, '2026-03-25 11:00:00'),   -- non-submitter
  (12, 1, 13, 2, 1, '2026-03-25 11:30:00'),
  (13, 1, 14, 2, 1, '2026-03-25 12:00:00'),
  (14, 1, 15, 2, 1, '2026-03-25 12:30:00'),

  -- Votes for statement 3 (VolunteerMatch) - total weight: 8
  (15, 1, 5,  3, 2, '2026-03-25 09:30:00'),   -- submitter self-vote
  (16, 1, 9,  3, 2, '2026-03-25 10:00:00'),
  (17, 1, 3,  3, 1, '2026-03-26 09:00:00'),
  (18, 1, 7,  3, 1, '2026-03-26 09:30:00'),
  (19, 1, 17, 3, 1, '2026-03-26 10:00:00'),
  (20, 1, 16, 3, 1, '2026-03-26 10:30:00'),

  -- Votes for statement 4 (AI Literacy Seniors) - total weight: 4 (below threshold)
  (21, 1, 6,  4, 2, '2026-03-25 13:00:00'),   -- submitter self-vote
  (22, 1, 10, 4, 1, '2026-03-25 13:30:00'),
  (23, 1, 11, 4, 1, '2026-03-26 11:00:00'),

  -- Votes for statement 5 (Budget Data) - total weight: 4 (below threshold)
  (24, 1, 7,  5, 2, '2026-03-25 14:00:00'),   -- submitter self-vote
  (25, 1, 15, 5, 1, '2026-03-26 09:00:00'),
  (26, 1, 6,  5, 1, '2026-03-26 09:30:00'),

  -- Votes for statement 6 (Career Changer AI) - total weight: 3
  (27, 1, 8,  6, 2, '2026-03-25 15:00:00'),   -- submitter self-vote
  (28, 1, 13, 6, 1, '2026-03-26 11:30:00'),

  -- Votes for statement 7 (NLP Legislation) - total weight: 2
  (29, 1, 9,  7, 1, '2026-03-26 12:00:00'),   -- submitter self-vote
  (30, 1, 14, 7, 1, '2026-03-26 12:30:00'),

  -- Votes for statement 8 (Mutual Aid) - total weight: 2
  (31, 1, 10, 8, 1, '2026-03-26 13:00:00'),   -- submitter self-vote
  (32, 1, 17, 8, 1, '2026-03-26 13:30:00');

-- 9. Pods (3 from top-voted problem statements)
INSERT INTO pods (id, cycle_id, problem_statement_id, name, status, slack_channel_id, github_repo_url, drive_folder_id, google_group_email, created_at, updated_at) VALUES
  (1, 1, 1, 'GovNavigate AI',    'active', 'C07GOVNAV', 'https://github.com/tul-labs/govnavigate-ai', 'folder_gov_123', 'govnavigate@groups.example.com', '2026-03-29 10:00:00', '2026-04-02 10:00:00'),
  (2, 1, 2, 'SmallBiz AI Boost', 'active', 'C07BIZBST', 'https://github.com/tul-labs/smallbiz-ai',    'folder_biz_456', 'smallbiz@groups.example.com',    '2026-03-29 10:00:00', '2026-04-02 10:00:00'),
  (3, 1, 3, 'VolunteerMatch AI', 'active', 'C07VOLMCH', 'https://github.com/tul-labs/volunteermatch',  'folder_vol_789', 'volmatch@groups.example.com',    '2026-03-29 10:00:00', '2026-04-02 10:00:00');

-- 10. Moderator Assignments
INSERT INTO moderator_assignments (id, participant_id, pod_id, cycle_id, assigned_at) VALUES
  (1, 1, 1, 1, '2026-03-29 12:00:00'),
  (2, 2, 2, 1, '2026-03-29 12:00:00'),
  (3, 3, 3, 1, '2026-03-29 12:00:00');

-- 11. Pod Memberships (distribute 17 active participants across 3 pods)
INSERT INTO pod_memberships (id, participant_id, pod_id, joined_at, inactive_at) VALUES
  -- Pod 1: GovNavigate AI (7 members)
  (1,  1,  1, '2026-03-30 09:00:00', NULL),
  (2,  3,  1, '2026-03-30 09:15:00', NULL),
  (3,  7,  1, '2026-03-30 09:30:00', NULL),
  (4,  11, 1, '2026-03-30 10:00:00', NULL),
  (5,  12, 1, '2026-03-30 10:15:00', NULL),
  (6,  15, 1, '2026-03-30 10:30:00', NULL),
  (7,  16, 1, '2026-03-30 11:00:00', NULL),
  -- Pod 2: SmallBiz AI Boost (6 members)
  (8,  2,  2, '2026-03-30 09:00:00', NULL),
  (9,  4,  2, '2026-03-30 09:15:00', NULL),
  (10, 8,  2, '2026-03-30 09:30:00', NULL),
  (11, 10, 2, '2026-03-30 10:00:00', NULL),
  (12, 13, 2, '2026-03-30 10:15:00', NULL),
  (13, 14, 2, '2026-03-30 10:30:00', NULL),
  -- Pod 3: VolunteerMatch AI (6 members, 1 inactive)
  (14, 5,  3, '2026-03-30 09:00:00', NULL),
  (15, 6,  3, '2026-03-30 09:15:00', NULL),
  (16, 9,  3, '2026-03-30 09:30:00', NULL),
  (17, 17, 3, '2026-03-30 10:00:00', NULL),
  (18, 19, 3, '2026-03-30 10:15:00', '2026-04-03 09:00:00'),
  (19, 5,  1, '2026-03-31 08:00:00', NULL);   -- Sarah in 2 pods

-- 12. Solution Proposals (2 per pod)
INSERT INTO solution_proposals (id, cycle_id, pod_id, participant_id, proposal_text, created_at) VALUES
  (1, 1, 1, 3,  'Build a chatbot that uses RAG over DC.gov content to answer resident questions about permits, licenses, and services in plain language.', '2026-04-04 10:00:00'),
  (2, 1, 1, 12, 'Create a unified search interface with AI-powered categorization that maps government services to life events (moving, starting a business, etc).', '2026-04-04 14:00:00'),
  (3, 1, 2, 4,  'Develop a Slack bot that generates social media posts, email campaigns, and flyer copy using GPT fine-tuned on successful small business marketing.', '2026-04-04 11:00:00'),
  (4, 1, 2, 8,  'Build a web dashboard that analyzes a small business''s online presence and provides AI-generated recommendations for improvement.', '2026-04-05 09:00:00'),
  (5, 1, 3, 9,  'Create a matching platform that uses NLP to parse volunteer skills and organization needs, generating ranked match suggestions.', '2026-04-04 13:00:00'),
  (6, 1, 3, 6,  'Build an AI scheduling assistant that coordinates availability between volunteers and organizations, with automated reminders.', '2026-04-05 10:00:00');

-- 13. Project Votes (pod members vote on proposals within their pod)
INSERT INTO project_votes (id, cycle_id, pod_id, voter_id, solution_proposal_id, vote_count, created_at) VALUES
  -- Pod 1 votes (proposal 1 wins with 6 votes vs proposal 2 with 3)
  (1,  1, 1, 1,  1, 1, '2026-04-08 09:00:00'),
  (2,  1, 1, 3,  1, 3, '2026-04-08 09:15:00'),  -- submitter
  (3,  1, 1, 7,  1, 1, '2026-04-08 09:30:00'),
  (4,  1, 1, 15, 1, 1, '2026-04-08 10:00:00'),
  (5,  1, 1, 11, 2, 1, '2026-04-08 10:30:00'),
  (6,  1, 1, 12, 2, 1, '2026-04-08 11:00:00'),
  (7,  1, 1, 16, 2, 1, '2026-04-08 11:30:00'),
  -- Pod 2 votes (proposal 3 wins with 5 votes vs proposal 4 with 3)
  (8,  1, 2, 4,  3, 3, '2026-04-08 09:00:00'),  -- submitter
  (9,  1, 2, 2,  3, 1, '2026-04-08 09:30:00'),
  (10, 1, 2, 13, 3, 1, '2026-04-08 10:00:00'),
  (11, 1, 2, 8,  4, 1, '2026-04-08 10:30:00'),
  (12, 1, 2, 10, 4, 1, '2026-04-08 11:00:00'),
  (13, 1, 2, 14, 4, 1, '2026-04-08 11:30:00'),
  -- Pod 3 votes (proposal 5 wins with 5 votes vs proposal 6 with 2)
  (14, 1, 3, 9,  5, 3, '2026-04-08 09:00:00'),  -- submitter
  (15, 1, 3, 5,  5, 1, '2026-04-08 09:30:00'),
  (16, 1, 3, 17, 5, 1, '2026-04-08 10:00:00'),
  (17, 1, 3, 6,  6, 1, '2026-04-08 10:30:00'),
  (18, 1, 3, 19, 6, 1, '2026-04-08 11:00:00');

-- 14. Projects (1 per pod, from winning proposals)
INSERT INTO projects (id, cycle_id, pod_id, solution_proposal_id, name, status, slack_channel_id, github_repo_url, drive_folder_id, google_group_email, created_at, updated_at) VALUES
  (1, 1, 1, 1, 'DC GovBot',     'active',  'C07DCGBOT', 'https://github.com/tul-labs/dc-govbot',     'folder_proj_001', 'dc-govbot@groups.example.com',    '2026-04-11 10:00:00', '2026-04-11 10:00:00'),
  (2, 1, 2, 3, 'BizBoost DC',   'forming', NULL,         NULL,                                         NULL,               NULL,                               '2026-04-11 10:00:00', '2026-04-11 10:00:00'),
  (3, 1, 3, 5, 'VolConnect DC', 'forming', NULL,         NULL,                                         NULL,               NULL,                               '2026-04-11 10:00:00', '2026-04-11 10:00:00');

-- 15. Project Memberships
INSERT INTO project_memberships (id, participant_id, project_id, cycle_id, registered_at, left_at) VALUES
  -- Project 1: DC GovBot (4 members from Pod 1)
  (1,  1,  1, 1, '2026-04-12 09:00:00', NULL),
  (2,  3,  1, 1, '2026-04-12 09:30:00', NULL),
  (3,  7,  1, 1, '2026-04-12 10:00:00', NULL),
  (4,  15, 1, 1, '2026-04-12 10:30:00', NULL),
  -- Project 2: BizBoost DC (4 members from Pod 2)
  (5,  2,  2, 1, '2026-04-12 09:00:00', NULL),
  (6,  4,  2, 1, '2026-04-12 09:30:00', NULL),
  (7,  8,  2, 1, '2026-04-12 10:00:00', NULL),
  (8,  10, 2, 1, '2026-04-12 10:30:00', NULL),
  -- Project 3: VolConnect DC (3 members from Pod 3)
  (9,  5,  3, 1, '2026-04-12 09:00:00', NULL),
  (10, 9,  3, 1, '2026-04-12 09:30:00', NULL),
  (11, 17, 3, 1, '2026-04-12 10:00:00', NULL);

-- 16. Pulse Checks (2 scheduled weeks)
INSERT INTO pulse_checks (id, cycle_id, participant_id, scheduled_date, completed_at, survey_responses, created_at) VALUES
  -- Week 1: 2026-03-30 (most completed)
  (1,  1, 1,  '2026-03-30', '2026-03-30 14:00:00', '{"energy_level": 4, "blockers": "none", "benefits": [28, 30], "comments": "Great kickoff week!"}', '2026-03-30 08:00:00'),
  (2,  1, 2,  '2026-03-30', '2026-03-30 16:00:00', '{"energy_level": 5, "blockers": "none", "benefits": [28, 29], "comments": "Excited to get started."}', '2026-03-30 08:00:00'),
  (3,  1, 3,  '2026-03-30', '2026-03-31 09:00:00', '{"energy_level": 3, "blockers": "Still getting oriented", "benefits": [29], "comments": "Learning a lot."}', '2026-03-30 08:00:00'),
  (4,  1, 4,  '2026-03-30', '2026-03-30 20:00:00', '{"energy_level": 4, "blockers": "none", "benefits": [28, 31], "comments": "Good collaboration so far."}', '2026-03-30 08:00:00'),
  (5,  1, 5,  '2026-03-30', '2026-03-31 10:00:00', '{"energy_level": 4, "blockers": "none", "benefits": [30, 32], "comments": "Design work is going well."}', '2026-03-30 08:00:00'),
  (6,  1, 6,  '2026-03-30', '2026-03-30 18:00:00', '{"energy_level": 5, "blockers": "none", "benefits": [28, 33], "comments": "Solved a tricky data issue."}', '2026-03-30 08:00:00'),
  (7,  1, 7,  '2026-03-30', NULL, NULL, '2026-03-30 08:00:00'),   -- not completed
  (8,  1, 8,  '2026-03-30', '2026-03-31 11:00:00', '{"energy_level": 3, "blockers": "Time management", "benefits": [29], "comments": "Juggling job search."}', '2026-03-30 08:00:00'),
  (9,  1, 9,  '2026-03-30', '2026-03-30 19:00:00', '{"energy_level": 4, "blockers": "none", "benefits": [28, 30], "comments": "Loving the design work."}', '2026-03-30 08:00:00'),
  (10, 1, 10, '2026-03-30', NULL, NULL, '2026-03-30 08:00:00'),   -- not completed

  -- Week 2: 2026-04-06 (some completed, some pending)
  (11, 1, 1,  '2026-04-06', '2026-04-06 15:00:00', '{"energy_level": 4, "blockers": "none", "benefits": [28, 31], "comments": "Proposal phase going smoothly."}', '2026-04-06 08:00:00'),
  (12, 1, 2,  '2026-04-06', '2026-04-06 17:00:00', '{"energy_level": 4, "blockers": "none", "benefits": [29, 33], "comments": "Good progress this week."}', '2026-04-06 08:00:00'),
  (13, 1, 3,  '2026-04-06', '2026-04-07 08:00:00', '{"energy_level": 3, "blockers": "Unclear on next steps", "benefits": [29], "comments": "Need more guidance."}', '2026-04-06 08:00:00'),
  (14, 1, 4,  '2026-04-06', '2026-04-06 21:00:00', '{"energy_level": 5, "blockers": "none", "benefits": [28, 32], "comments": "Built a working prototype."}', '2026-04-06 08:00:00'),
  (15, 1, 5,  '2026-04-06', NULL, NULL, '2026-04-06 08:00:00'),   -- not completed
  (16, 1, 6,  '2026-04-06', NULL, NULL, '2026-04-06 08:00:00'),   -- not completed
  (17, 1, 9,  '2026-04-06', '2026-04-07 09:00:00', '{"energy_level": 4, "blockers": "none", "benefits": [30, 31], "comments": "Great team synergy."}', '2026-04-06 08:00:00'),
  (18, 1, 12, '2026-04-06', NULL, NULL, '2026-04-06 08:00:00');   -- not completed

-- Reset all sequences to avoid ID conflicts with future inserts
SELECT setval('cycles_id_seq', (SELECT MAX(id) FROM cycles));
SELECT setval('cycle_config_id_seq', (SELECT MAX(id) FROM cycle_config));
SELECT setval('participants_id_seq', (SELECT MAX(id) FROM participants));
SELECT setval('cycle_enrollments_id_seq', (SELECT MAX(id) FROM cycle_enrollments));
SELECT setval('user_roles_id_seq', (SELECT MAX(id) FROM user_roles));
SELECT setval('problem_statements_id_seq', (SELECT MAX(id) FROM problem_statements));
SELECT setval('votes_id_seq', (SELECT MAX(id) FROM votes));
SELECT setval('pods_id_seq', (SELECT MAX(id) FROM pods));
SELECT setval('moderator_assignments_id_seq', (SELECT MAX(id) FROM moderator_assignments));
SELECT setval('pod_memberships_id_seq', (SELECT MAX(id) FROM pod_memberships));
SELECT setval('solution_proposals_id_seq', (SELECT MAX(id) FROM solution_proposals));
SELECT setval('project_votes_id_seq', (SELECT MAX(id) FROM project_votes));
SELECT setval('projects_id_seq', (SELECT MAX(id) FROM projects));
SELECT setval('project_memberships_id_seq', (SELECT MAX(id) FROM project_memberships));
SELECT setval('pulse_checks_id_seq', (SELECT MAX(id) FROM pulse_checks));

COMMIT;
