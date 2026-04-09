-- OLOS / The Upskilling Labs - Initial Schema
-- All 18 core tables per TUL_MVP_Spec.md

-- 1. cycles
CREATE TABLE cycles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(50) UNIQUE,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'active', 'closed'
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. cycle_config
CREATE TABLE cycle_config (
  id SERIAL PRIMARY KEY,
  cycle_id INT NOT NULL REFERENCES cycles(id) UNIQUE,

  -- Pod-layer voting
  submitter_votes SMALLINT NOT NULL DEFAULT 3,
  non_submitter_votes SMALLINT NOT NULL DEFAULT 1,
  vote_threshold SMALLINT NOT NULL DEFAULT 5,
  max_pods SMALLINT NOT NULL DEFAULT 8,
  pod_min SMALLINT NOT NULL DEFAULT 5,

  -- Project-layer voting
  project_submitter_votes SMALLINT NOT NULL DEFAULT 3,
  project_vote_threshold SMALLINT NOT NULL DEFAULT 5,
  max_projects SMALLINT NOT NULL DEFAULT 8,

  -- Project registration
  project_min SMALLINT NOT NULL DEFAULT 3,
  project_max SMALLINT NOT NULL DEFAULT 7,

  -- Window timings (NULL = not yet scheduled)
  problem_statement_open TIMESTAMP,
  problem_statement_close TIMESTAMP,
  voting_open TIMESTAMP,
  voting_close TIMESTAMP,
  pod_registration_open TIMESTAMP,
  pod_registration_close TIMESTAMP,
  solution_proposal_open TIMESTAMP,
  solution_proposal_close TIMESTAMP,
  solution_voting_open TIMESTAMP,
  solution_voting_close TIMESTAMP,
  project_registration_open TIMESTAMP,
  project_registration_close TIMESTAMP,

  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. participants
CREATE TABLE participants (
  id SERIAL PRIMARY KEY,
  auth_user_id UUID UNIQUE, -- Supabase Auth user ID (linked after OAuth)
  google_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,

  -- Identity
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  preferred_name VARCHAR(255),
  gender VARCHAR(100),

  -- Location
  state VARCHAR(10) CHECK (state IN ('MD', 'DC', 'VA', 'Other')) NOT NULL,
  neighborhood VARCHAR(255) NOT NULL,

  -- DCPL
  dcpl_card VARCHAR(20) CHECK (dcpl_card IN ('yes', 'no', 'not sure')) NOT NULL,
  dcpl_info BOOLEAN,

  -- Professional context
  work_situation VARCHAR(50) CHECK (work_situation IN (
    'employed full time', 'employed part-time', 'self-employed',
    'unemployed and jobseeking', 'in a career transition', 'student', 'prefer not to say'
  )) NOT NULL,
  main_focus VARCHAR(50) CHECK (main_focus IN (
    'finding a new role', 'building a portfolio', 'upskilling in current field',
    'exploring new directions', 'starting something new', 'other', 'n/a'
  )) NOT NULL,
  sector VARCHAR(255),
  current_title VARCHAR(255),
  linkedin VARCHAR(500),

  -- AI background
  ai_tool_familiarity SMALLINT CHECK (ai_tool_familiarity BETWEEN 1 AND 5) NOT NULL,

  -- Labs fit
  participation_commitment VARCHAR(20) CHECK (participation_commitment IN ('yes', 'uncertain')),
  primary_expertise VARCHAR(500),
  volunteer_interest VARCHAR(500),

  -- Consent & comms
  text_updates BOOLEAN NOT NULL,
  photo_video_consent BOOLEAN NOT NULL DEFAULT TRUE,
  source VARCHAR(255),

  -- Platform accounts (populated post-onboarding)
  slack_username VARCHAR(255),
  github_username VARCHAR(255),
  drive_email VARCHAR(255),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. option_lists
CREATE TABLE option_lists (
  id SERIAL PRIMARY KEY,
  list_name VARCHAR(50) NOT NULL,
  value VARCHAR(255) NOT NULL,
  display_order SMALLINT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(list_name, value)
);

-- 5. participant_options
CREATE TABLE participant_options (
  participant_id INT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  option_id INT NOT NULL REFERENCES option_lists(id),
  PRIMARY KEY (participant_id, option_id)
);

-- 6. cycle_enrollments
CREATE TABLE cycle_enrollments (
  id SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id),
  cycle_id INT NOT NULL REFERENCES cycles(id),
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'inactive', -- 'inactive', 'active', 'revoked'
  inactive_date TIMESTAMP,
  UNIQUE(participant_id, cycle_id)
);

-- 7. user_roles
CREATE TABLE user_roles (
  id SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'observer')),
  granted_by INT REFERENCES participants(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP,
  UNIQUE(participant_id, role)
);

-- 8. problem_statements
CREATE TABLE problem_statements (
  id SERIAL PRIMARY KEY,
  cycle_id INT NOT NULL REFERENCES cycles(id),
  participant_id INT NOT NULL REFERENCES participants(id),
  statement_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. votes
CREATE TABLE votes (
  id SERIAL PRIMARY KEY,
  cycle_id INT NOT NULL REFERENCES cycles(id),
  voter_id INT NOT NULL REFERENCES participants(id),
  problem_statement_id INT NOT NULL REFERENCES problem_statements(id),
  vote_count SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(voter_id, problem_statement_id, cycle_id)
);

-- 10. pods
CREATE TABLE pods (
  id SERIAL PRIMARY KEY,
  cycle_id INT NOT NULL REFERENCES cycles(id),
  problem_statement_id INT NOT NULL REFERENCES problem_statements(id),
  name VARCHAR(40),
  status VARCHAR(50) DEFAULT 'forming', -- 'forming', 'active', 'inactive'
  slack_channel_id VARCHAR(255),
  github_repo_url VARCHAR(255),
  drive_folder_id VARCHAR(255),
  google_group_email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. moderator_assignments
CREATE TABLE moderator_assignments (
  id SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id),
  pod_id INT NOT NULL REFERENCES pods(id),
  cycle_id INT NOT NULL REFERENCES cycles(id),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  removed_at TIMESTAMP,
  UNIQUE(participant_id, pod_id, cycle_id)
);

-- 12. pod_memberships
CREATE TABLE pod_memberships (
  id SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id),
  pod_id INT NOT NULL REFERENCES pods(id),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  inactive_at TIMESTAMP,
  UNIQUE(participant_id, pod_id)
);

-- 13. solution_proposals
CREATE TABLE solution_proposals (
  id SERIAL PRIMARY KEY,
  cycle_id INT NOT NULL REFERENCES cycles(id),
  pod_id INT NOT NULL REFERENCES pods(id),
  participant_id INT NOT NULL REFERENCES participants(id),
  proposal_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. project_votes
CREATE TABLE project_votes (
  id SERIAL PRIMARY KEY,
  cycle_id INT NOT NULL REFERENCES cycles(id),
  pod_id INT NOT NULL REFERENCES pods(id),
  voter_id INT NOT NULL REFERENCES participants(id),
  solution_proposal_id INT NOT NULL REFERENCES solution_proposals(id),
  vote_count SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(voter_id, solution_proposal_id, pod_id)
);

-- 15. projects
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  cycle_id INT NOT NULL REFERENCES cycles(id),
  pod_id INT NOT NULL REFERENCES pods(id),
  solution_proposal_id INT NOT NULL REFERENCES solution_proposals(id),
  name VARCHAR(40),
  status VARCHAR(50) DEFAULT 'forming', -- 'forming', 'active', 'inactive'
  slack_channel_id VARCHAR(255),
  github_repo_url VARCHAR(255),
  drive_folder_id VARCHAR(255),
  google_group_email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 16. project_memberships
CREATE TABLE project_memberships (
  id SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id),
  project_id INT NOT NULL REFERENCES projects(id),
  cycle_id INT NOT NULL REFERENCES cycles(id),
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP,
  UNIQUE(participant_id, project_id)
);

-- At most 1 active project registration per participant per cycle
CREATE UNIQUE INDEX one_active_project_per_cycle
  ON project_memberships (participant_id, cycle_id)
  WHERE left_at IS NULL;

-- 17. pulse_checks
CREATE TABLE pulse_checks (
  id SERIAL PRIMARY KEY,
  cycle_id INT NOT NULL REFERENCES cycles(id),
  participant_id INT NOT NULL REFERENCES participants(id),
  scheduled_date DATE NOT NULL,
  completed_at TIMESTAMP,
  survey_responses JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 18. access_revocations
CREATE TABLE access_revocations (
  id SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id),
  cycle_id INT NOT NULL REFERENCES cycles(id),
  reason VARCHAR(255),
  revocation_scope VARCHAR(50) NOT NULL DEFAULT 'full',
  revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_systems TEXT[] DEFAULT ARRAY[]::TEXT[]
);

-- Indexes for common queries
CREATE INDEX idx_cycle_enrollments_cycle ON cycle_enrollments(cycle_id);
CREATE INDEX idx_cycle_enrollments_participant ON cycle_enrollments(participant_id);
CREATE INDEX idx_problem_statements_cycle ON problem_statements(cycle_id);
CREATE INDEX idx_votes_cycle ON votes(cycle_id);
CREATE INDEX idx_votes_problem_statement ON votes(problem_statement_id);
CREATE INDEX idx_pods_cycle ON pods(cycle_id);
CREATE INDEX idx_pod_memberships_pod ON pod_memberships(pod_id);
CREATE INDEX idx_pod_memberships_participant ON pod_memberships(participant_id);
CREATE INDEX idx_solution_proposals_pod ON solution_proposals(pod_id);
CREATE INDEX idx_project_votes_pod ON project_votes(pod_id);
CREATE INDEX idx_projects_pod ON projects(pod_id);
CREATE INDEX idx_project_memberships_project ON project_memberships(project_id);
CREATE INDEX idx_project_memberships_participant ON project_memberships(participant_id);
CREATE INDEX idx_pulse_checks_cycle_participant ON pulse_checks(cycle_id, participant_id);
CREATE INDEX idx_access_revocations_participant ON access_revocations(participant_id);
CREATE INDEX idx_moderator_assignments_participant ON moderator_assignments(participant_id);
CREATE INDEX idx_moderator_assignments_pod ON moderator_assignments(pod_id);
CREATE INDEX idx_user_roles_participant ON user_roles(participant_id);
CREATE INDEX idx_participants_auth_user ON participants(auth_user_id);
