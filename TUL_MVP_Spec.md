# The Upskilling Labs (TUL) — WIN Challenge MVP Spec

## Overview
Build a system to manage **4 core touchpoints** across a Build Cycle and reduce manual effort to coordinate Upskillers in a cycle.
1. Participant registration (custom form → DB)
2. Problem statement submission + stack voting (custom form → DB → vote tally → pods)
3. Weekly pulse checks (custom form → DB)
4. Access revocation automation (Slack, Drive, GitHub)

**Stack:** PostgreSQL, Python/FastAPI, custom React forms + dashboard

---

## User Roles & Permissions

### Role Definitions

| Role | Cycle Participant? | Data Scope | Key Capabilities |
|------|--------------------|------------|-----------------|
| **Owner** | No | Global | All Admin capabilities + system config access. Reserved for future use; treated as Admin. |
| **Admin** | No | Global | Full visibility across all cycles, pods, projects, participants, and dashboards. Manages config values, access revocation, observer grants, and cycle administration. |
| **Moderator** | Optional | Assigned pods + their projects | Can manage pod membership for assigned pods. No access to other pods' data. |
| **Participant (active)** | Yes | Own pod + all projects within it | Completing weekly pulse checks AND registered in at least 1 pod. Submits problem statements and solution proposals; votes; self-registers for projects (subject to caps). |
| **Participant (inactive)** | Yes (limited) | Read-only | Has not completed pulse checks OR is not registered in any pod. A newly registered participant with no pod assignment is inactive by default. Inactive access profile: viewer on GitHub repos, viewer on Drive folders, removed from all pod and project Slack channels, project memberships revoked, pod membership retained and marked inactive. |
| **Observer** | No | All cycles/pods/projects (read-only) | Granted by Admin only. Dashboard viewing access. Separate track; cannot become a Participant. |

### Role Stacking
Roles can stack: a person can be both a Moderator and an active Participant simultaneously. Stacked roles grant the union of permissions across all assigned roles.

### Role Storage & Resolution

| Role | How it's stored |
|------|----------------|
| Owner, Admin, Observer | Row in `user_roles` with `role = 'owner'` / `'admin'` / `'observer'` |
| Moderator | Implied by an active row in `moderator_assignments`; scope is limited to the assigned pod(s) |
| Participant (active/inactive) | Derived — not stored as a role. Active = `cycle_enrollments.status = 'active'`; inactive = `'inactive'` |

**All users — including Admins and Observers — have a row in `participants`.** The `participants` table is the system-wide user record. Admins and Observers are not enrolled in cycles (`cycle_enrollments` has no row for them), while Participants are.

**JWT claims:** At token issuance (`POST /auth/google`), the backend resolves the full role set for the user:
1. Query `user_roles` for any `owner` / `admin` / `observer` grants (`revoked_at IS NULL`)
2. Query `moderator_assignments` for active pod assignments (`removed_at IS NULL`) — encoded as a list of pod IDs for the current cycle
3. Query `cycle_enrollments` for active cycle participation and status
4. Encode all into JWT claims

All authenticated endpoints authorize against JWT claims. Moderator pod-scope checks additionally query `moderator_assignments` at the endpoint level for any write operation.

**Moderator data visibility rule:** Moderator scope is determined by querying `moderator_assignments` for rows where `participant_id = current_user`, `cycle_id = current_cycle`, and `removed_at IS NULL`. Any endpoint returning pod-scoped data for a Moderator must join against this table. When a moderator assignment is removed (`removed_at` is populated), data visibility is cut off immediately — the moderator can no longer access that pod's data, members, or projects. A moderator with no active assignments has no pod-level visibility.

### User Relationships & Constraints

| Constraint | Scope | Enforcement |
|------------|-------|-------------|
| A participant may submit many problem statements | Across cycles | No cap; one submission per cycle per participant |
| A participant may submit many solution proposals | Across cycles | No cap; scoped to pods they are active members of |
| A participant may be registered in at most **2 active pods** simultaneously | Within a cycle | API layer: `POST /api/pods/{pod_id}/register` returns `400` if participant already has 2 active `pod_memberships` in this cycle |
| A participant may be registered in at most **1 active project** at a time | Across all pods in a cycle | API layer: `POST /api/projects/{project_id}/register` returns `400` if participant has any active `project_membership` in this cycle; also enforced by partial unique index on `project_memberships` |

All capacity violations return `HTTP 400` with a descriptive error message, e.g.:
- `"You are already registered in 2 pods for this cycle."`
- `"You are already registered in a project for this cycle. Withdraw first to register for a different project."`

---

## Data Architecture

### Core Tables

#### `cycles`
```sql
CREATE TABLE cycles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(50) UNIQUE,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'active' -- 'draft','active', 'closed'
);
```

#### `cycle_config`
```sql
-- Configurable values per cycle. Created with defaults when a cycle is created.
CREATE TABLE cycle_config (
  id SERIAL PRIMARY KEY,
  cycle_id INT NOT NULL REFERENCES cycles(id) UNIQUE,

  -- Pod-layer voting
  submitter_votes SMALLINT NOT NULL DEFAULT 3,       -- vote budget for participants who submitted a statement
  non_submitter_votes SMALLINT NOT NULL DEFAULT 1,   -- vote budget for participants who did not submit
  vote_threshold SMALLINT NOT NULL DEFAULT 5,        -- minimum votes a statement needs to be pod-eligible
  max_pods SMALLINT NOT NULL DEFAULT 8,              -- maximum number of pods on the shortlist per cycle
  pod_min SMALLINT NOT NULL DEFAULT 5,               -- minimum registrants for a pod to activate

  -- Project-layer voting
  project_submitter_votes SMALLINT NOT NULL DEFAULT 3,   -- vote budget for all active pod members (flat; no submitter differentiation)
  project_vote_threshold SMALLINT NOT NULL DEFAULT 5,    -- minimum votes a solution needs to be project-eligible
  max_projects SMALLINT NOT NULL DEFAULT 8,              -- maximum number of projects to form per pod

  -- Project registration
  project_min SMALLINT NOT NULL DEFAULT 3,               -- minimum registrants for a project to activate
  project_max SMALLINT NOT NULL DEFAULT 7,               -- maximum registrants per project

  -- Window timings (set per cycle; NULL = not yet scheduled)
  problem_statement_open TIMESTAMP,      -- when problem statement submission opens
  problem_statement_close TIMESTAMP,     -- when problem statement submission closes
  voting_open TIMESTAMP,                 -- when pod-level voting opens
  voting_close TIMESTAMP,                -- when pod-level voting closes
  pod_registration_open TIMESTAMP,       -- when pod self-registration opens
  pod_registration_close TIMESTAMP,      -- when pod self-registration closes
  solution_proposal_open TIMESTAMP,      -- when solution proposal submission opens
  solution_proposal_close TIMESTAMP,     -- when solution proposal submission closes
  solution_voting_open TIMESTAMP,        -- when solution voting opens
  solution_voting_close TIMESTAMP,       -- when solution voting closes
  project_registration_open TIMESTAMP,   -- when project self-registration opens
  project_registration_close TIMESTAMP,  -- when project self-registration closes

  -- Window enforcement: all open/close timestamps above are enforced server-side by the API.
  -- Requests outside a defined window return 403 Forbidden with a descriptive error.
  -- NULL timestamps mean the window has not been scheduled; the endpoint also returns 403.
  -- No admin overrides — the block applies to all roles equally.
  -- Example error: "Problem statement submission is not currently open."

  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `participants`
```sql
CREATE TABLE participants (
  id SERIAL PRIMARY KEY,
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
  dcpl_info BOOLEAN,  -- NULL = not answered; true = yes, false = no

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
  -- ai_tools → participant_options (list_name = 'ai_tools')

  -- Labs fit
  -- labs_goals    → participant_options (list_name = 'labs_goals')
  -- availability  → participant_options (list_name = 'availability')
  -- work_style    → participant_options (list_name = 'work_style')
  -- group_strengths → participant_options (list_name = 'group_strengths')
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
```

#### `option_lists`
```sql
-- Seed rows define all valid choices for every multiselect field.
-- list_name values: 'ai_tools', 'labs_goals', 'availability', 'work_style', 'group_strengths'
CREATE TABLE option_lists (
  id SERIAL PRIMARY KEY,
  list_name VARCHAR(50) NOT NULL,
  value VARCHAR(255) NOT NULL,
  display_order SMALLINT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(list_name, value)
);
```

#### `participant_options`
```sql
-- Junction table linking participants to their multiselect choices.
CREATE TABLE participant_options (
  participant_id INT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  option_id INT NOT NULL REFERENCES option_lists(id),
  PRIMARY KEY (participant_id, option_id)
);
```

#### `cycle_enrollments`
```sql
CREATE TABLE cycle_enrollments (
  id SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id),
  cycle_id INT NOT NULL REFERENCES cycles(id),
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'inactive',  -- 'inactive' = default on registration; 'active' = in a pod + completing pulse checks; 'revoked' = removed by admin
  inactive_date TIMESTAMP,  -- populated when participant transitions to inactive status
  UNIQUE(participant_id, cycle_id)
);
```

#### `user_roles`
```sql
-- Stores elevated roles: owner, admin, observer.
-- Moderator role is implied by moderator_assignments; Participant status is derived from cycle_enrollments.
CREATE TABLE user_roles (
  id SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'observer')),
  granted_by INT REFERENCES participants(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP,  -- NULL = active grant; non-null = revoked
  UNIQUE(participant_id, role)
);
```

#### `moderator_assignments`
```sql
-- Pod-scoped moderator assignments, scoped per cycle.
-- A participant is a Moderator for a pod if and only if they have an active row here (removed_at IS NULL).
-- Assignments can only be made after the pod exists (status = 'forming' or later).
-- Rows are never deleted — removal is recorded via removed_at.
CREATE TABLE moderator_assignments (
  id SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id),
  pod_id INT NOT NULL REFERENCES pods(id),
  cycle_id INT NOT NULL REFERENCES cycles(id),  -- denormalized for query efficiency; scoped per cycle
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  removed_at TIMESTAMP,  -- NULL = active assignment; non-null = removed (cutoff timestamp)
  UNIQUE(participant_id, pod_id, cycle_id)
);
```

#### `problem_statements`
```sql
CREATE TABLE problem_statements (
  id SERIAL PRIMARY KEY,
  cycle_id INT NOT NULL REFERENCES cycles(id),
  participant_id INT NOT NULL REFERENCES participants(id),
  statement_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `votes`
```sql
CREATE TABLE votes (
  id SERIAL PRIMARY KEY,
  cycle_id INT NOT NULL REFERENCES cycles(id),
  voter_id INT NOT NULL REFERENCES participants(id),
  problem_statement_id INT NOT NULL REFERENCES problem_statements(id),
  vote_count SMALLINT NOT NULL DEFAULT 1,  -- votes this participant allocated to this statement
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(voter_id, problem_statement_id, cycle_id)
);
```

#### `pods`
```sql
CREATE TABLE pods (
  id SERIAL PRIMARY KEY,
  cycle_id INT NOT NULL REFERENCES cycles(id),
  problem_statement_id INT NOT NULL REFERENCES problem_statements(id),
  name VARCHAR(40),   -- auto-generated at formation time via LLM; max 40 characters; can be overridden by Admin/Moderator
  status VARCHAR(50) DEFAULT 'forming',  -- 'forming' = shortlisted, accepting registrations; 'active' = reached pod_min; 'inactive' = did not reach pod_min
  slack_channel_id VARCHAR(255),
  github_repo_url VARCHAR(255),
  drive_folder_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `pod_memberships`
```sql
CREATE TABLE pod_memberships (
  id SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id),
  pod_id INT NOT NULL REFERENCES pods(id),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  inactive_at TIMESTAMP,  -- NULL = active; non-null = inactive (pod membership is retained but marked inactive; not deleted)
  UNIQUE(participant_id, pod_id)
);
```

#### `solution_proposals`
```sql
-- Mirrors problem_statements but scoped to a pod. Only active pod members may submit.
CREATE TABLE solution_proposals (
  id SERIAL PRIMARY KEY,
  cycle_id INT NOT NULL REFERENCES cycles(id),
  pod_id INT NOT NULL REFERENCES pods(id),
  participant_id INT NOT NULL REFERENCES participants(id),
  proposal_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `project_votes`
```sql
-- Mirrors votes but for the project layer; scoped strictly within a pod.
CREATE TABLE project_votes (
  id SERIAL PRIMARY KEY,
  cycle_id INT NOT NULL REFERENCES cycles(id),
  pod_id INT NOT NULL REFERENCES pods(id),
  voter_id INT NOT NULL REFERENCES participants(id),
  solution_proposal_id INT NOT NULL REFERENCES solution_proposals(id),
  vote_count SMALLINT NOT NULL DEFAULT 1,  -- votes this participant allocated to this solution
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(voter_id, solution_proposal_id, pod_id)
);
```

#### `projects`
```sql
-- Mirrors pods but children of pods. Hierarchy: Cycle → Pod → Project.
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  cycle_id INT NOT NULL REFERENCES cycles(id),
  pod_id INT NOT NULL REFERENCES pods(id),
  solution_proposal_id INT NOT NULL REFERENCES solution_proposals(id),
  name VARCHAR(40),   -- auto-generated at formation time via LLM; max 40 characters; can be overridden by Admin/Moderator
  status VARCHAR(50) DEFAULT 'forming',  -- 'forming', 'active', 'inactive'
  slack_channel_id VARCHAR(255),
  github_repo_url VARCHAR(255),
  drive_folder_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `project_memberships`
```sql
-- Mirrors pod_memberships. Participants self-register; enforces 1 active project per participant per cycle.
CREATE TABLE project_memberships (
  id SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id),
  project_id INT NOT NULL REFERENCES projects(id),
  cycle_id INT NOT NULL REFERENCES cycles(id),  -- denormalized for constraint enforcement
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP,  -- NULL = active; non-null = withdrawn or removed
  UNIQUE(participant_id, project_id)
);
-- At most 1 active project registration per participant per cycle (enforced via partial unique index):
-- CREATE UNIQUE INDEX one_active_project_per_cycle ON project_memberships (participant_id, cycle_id) WHERE left_at IS NULL;
```

#### `pulse_checks`
```sql
CREATE TABLE pulse_checks (
  id SERIAL PRIMARY KEY,
  cycle_id INT NOT NULL REFERENCES cycles(id),
  participant_id INT NOT NULL REFERENCES participants(id),
  scheduled_date DATE NOT NULL,  -- e.g., Sunday night send date
  completed_at TIMESTAMP,  -- NULL = incomplete
  survey_responses JSONB,  -- flexible schema for survey answers
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `access_revocations`
```sql
CREATE TABLE access_revocations (
  id SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id),
  cycle_id INT NOT NULL REFERENCES cycles(id),
  reason VARCHAR(255),  -- e.g., 'missed_pulse_checks', 'not_in_pod'
  revocation_scope VARCHAR(50) NOT NULL DEFAULT 'full',  -- 'pod': pod Slack only; 'project': project memberships only; 'full': all systems
  revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_systems TEXT[] DEFAULT ARRAY[]::TEXT[]  -- e.g., ['slack_pod', 'slack_project', 'drive', 'github', 'project_membership']
);
```

---

## API Endpoints

### Authentication
```
POST /auth/google
  Input: { google_token }
  Output: { user_id, email, jwt_token }
  Purpose: Exchange Google OAuth token for session
  Auth: None (public)
  Roles: Any unauthenticated user
```

### Cycle Management
```
POST /api/cycles
  Input: { name, slug?, start_date, end_date }
  Output: { id, name, slug, start_date, end_date, status, config: { ...defaults } }
  Purpose: Create a new cycle; automatically creates a cycle_config row with all default values
  Auth: Admin JWT
  Roles: Admin, Owner

GET /api/cycles/{cycle_id}
  Output: { id, name, slug, start_date, end_date, status }
  Auth: JWT
  Roles: Admin, Owner, Observer (any cycle); Moderator, Participant (enrolled cycles only)

GET /api/cycles/{cycle_id}/config
  Output: { submitter_votes, non_submitter_votes, vote_threshold, max_pods, pod_min,
            project_submitter_votes, project_vote_threshold, max_projects, project_min, project_max,
            problem_statement_open, problem_statement_close,
            voting_open, voting_close,
            pod_registration_open, pod_registration_close,
            solution_proposal_open, solution_proposal_close,
            solution_voting_open, solution_voting_close,
            project_registration_open, project_registration_close }
  Auth: Admin JWT
  Roles: Admin, Owner

PATCH /api/cycles/{cycle_id}/config
  Input: any subset of cycle_config fields
  Output: updated config object
  Purpose: Update one or more config values before or during a cycle
  Auth: Admin JWT
  Notes: Any field can be updated individually; omitted fields are left unchanged
  Roles: Admin, Owner
```

### Role Management
```
POST /api/roles/observer
  Input: { participant_id }
  Output: { id, granted_at }
  Purpose: Grant Observer access to a user
  Auth: Admin JWT
  Roles: Admin, Owner

DELETE /api/roles/observer/{participant_id}
  Output: { success }
  Purpose: Revoke Observer access
  Auth: Admin JWT
  Roles: Admin, Owner

```

### Moderator Assignments
```
POST /api/pods/{pod_id}/moderators
  Input: { participant_id, cycle_id }
  Output: { moderator_assignment_id, participant_id, pod_id, assigned_at }
  Purpose: Assign a moderator to a pod for a cycle
  Auth: Admin JWT
  Validation:
    - Pod must exist (status = 'forming', 'active', or 'inactive')
    - Participant must exist
    - No active assignment already exists for this participant + pod + cycle
  Roles: Admin, Owner

DELETE /api/pods/{pod_id}/moderators/{participant_id}
  Input: { cycle_id }
  Output: { success, removed_at }
  Purpose: Remove a moderator from a pod; sets removed_at and immediately cuts off data visibility
  Auth: Admin JWT
  Roles: Admin, Owner

GET /api/pods/{pod_id}/moderators
  Output: [ { participant_id, name, assigned_at, removed_at } ]
  Purpose: List all moderator assignments for a pod in a cycle (active and removed)
  Auth: Admin JWT
  Roles: Admin, Owner
```

### Option Lists
```
GET /api/options
  Output: { ai_tools: [{id, value}], labs_goals: [{id, value}], availability: [{id, value}], work_style: [{id, value}], group_strengths: [{id, value}] }
  Purpose: Populate multiselect dropdowns on the registration form
  Auth: None (public)
  Roles: Public

POST /api/options
  Input: { list_name, value, display_order? }
  Output: { id, list_name, value }
  Purpose: Add a new option to a list
  Auth: Admin JWT
  Roles: Admin, Owner

PATCH /api/options/{option_id}
  Input: { active?, display_order? }
  Purpose: Retire or reorder an option (never hard-delete — historical data references it)
  Auth: Admin JWT
  Roles: Admin, Owner
```

### Registration & Enrollment
```
POST /api/registrations
  Input: {
    google_id, email,
    first_name, last_name, preferred_name?, gender?,
    state, neighborhood,
    dcpl_card, dcpl_info?,
    work_situation, main_focus, sector?, current_title?, linkedin?,
    ai_tool_familiarity,
    ai_tools?: [option_id, ...],         -- list_name = 'ai_tools'
    labs_goals?: [option_id, ...],       -- list_name = 'labs_goals'
    availability?: [option_id, ...],     -- list_name = 'availability'
    work_style?: [option_id, ...],       -- list_name = 'work_style'
    group_strengths?: [option_id, ...],  -- list_name = 'group_strengths'
    participation_commitment?,
    primary_expertise?,
    volunteer_interest?,
    text_updates, photo_video_consent, source?
  }
  Output: { participant_id, created_at }
  Purpose: Custom registration form submission (pre-authentication; new participants submit before account exists)
  Auth: None (public endpoint; CSRF protection required)
  Roles: Public (unauthenticated)

GET /api/participants/{participant_id}
  Output: {
    id, email, first_name, last_name, preferred_name,
    state, neighborhood, work_situation, main_focus,
    ai_tool_familiarity,
    ai_tools: [{ id, value }], labs_goals: [{ id, value }],
    availability: [{ id, value }], work_style: [{ id, value }],
    group_strengths: [{ id, value }],
    participation_commitment,
    problem_statement_submitted  -- derived: EXISTS(SELECT 1 FROM problem_statements WHERE participant_id = ? AND cycle_id = ?)
  }
  Auth: JWT
  Roles: Participant (own record only); Moderator (participants in assigned pods); Admin, Owner (any participant)
```

### Problem Statement Submission (Phase 1)
```
POST /api/problem-statements
  Input: { cycle_id, participant_id, statement_text }
  Output: { id, created_at }
  Purpose: Custom form submission during the problem statement window
  Auth: JWT
  Window: problem_statement_open / problem_statement_close — 403 "Problem statement submission is not currently open."
  Roles: Participant (active)

GET /api/problem-statements/{cycle_id}
  Output: [ { id, participant_id, statement_text } ]
  Auth: JWT
  Purpose: View all submitted statements (for reference during voting phase)
  Roles: Participant (active), Moderator, Admin, Owner
```

### Problem Statement Voting (Phase 2)
```
POST /api/votes
  Input: { cycle_id, voter_id, problem_statement_id, vote_count }
  Output: { id, created_at, votes_remaining }
  Purpose: Allocate votes to a problem statement; callable multiple times for different statements
  Auth: JWT
  Window: voting_open / voting_close — 403 "Voting is not currently open."
  Validation:
    - vote_count must be >= 1
    - participant's total allocated votes across all submissions for this cycle must not exceed their budget
    - budget = submitter_votes (cycle_config) if voter submitted a statement, else non_submitter_votes
  Roles: Participant (active)

GET /api/votes/{cycle_id}
  Output: {
    tallies: [ { problem_statement_id, total_votes } ],  -- aggregated totals, sorted descending; visible to all during voting window
    votes: [ { voter_id, problem_statement_id, vote_count } ]  -- voter-level detail; Admin/Owner only
  }
  Auth: JWT
  Purpose: Aggregated tallies power the voting dashboard; voter-level detail is restricted
  Roles: Tallies — all enrolled participants, Moderator, Observer, Admin, Owner (during active voting window); Voter-level detail — Admin, Owner only
```

### Pod Shortlist Finalization (Phase 3)
```
POST /api/voting/finalize/{cycle_id}
  Input: {}
  Output: { 
    pods: [ { id, name, problem_statement_id, total_votes, status: 'forming' } ],
    eligible_statements: [ { problem_statement_id, total_votes, rank } ],
    ineligible_statements: [ { problem_statement_id, total_votes } ]
  }
  Purpose: 
    1. Tally total votes per problem statement (SUM of vote_count grouped by problem_statement_id)
    2. Filter to statements with total_votes >= vote_threshold (cycle_config)
    3. Rank eligible statements by total votes descending
    4. Create up to max_pods pods (cycle_config) in 'forming' status — this publishes the pod shortlist
    5. For each created pod, call the name generation service with the associated problem statement text;
       write the result to pods.name. Fallback: first 40 characters of statement text, trimmed to nearest word.
    6. Return full tally including ineligible statements
  Auth: Admin JWT
  Notes:
    - Tie-breaking: submission time (earliest first)
    - Pods start in 'forming' status; they activate when registrations reach pod_min (cycle_config)
    - Call after voting window closes; opens the pod registration window
  Roles: Admin, Owner
```

### Pod Registration (Phase 3b)
```
POST /api/pods/{pod_id}/register
  Input: { participant_id }
  Output: { pod_membership_id, registered_at }
  Purpose: Self-register for a pod from the shortlist
  Auth: JWT
  Window: pod_registration_open / pod_registration_close — 403 "Pod registration is not currently open."
  Validation:
    - Pod must be in 'forming' or 'active' status
    - Participant must not already have 2 active pod_memberships in this cycle → 400 "You are already registered in 2 pods for this cycle."
    - Participant must not already be registered for this pod → 400 "You are already registered for this pod."
  Side effect: If pod's active registrant count reaches pod_min (cycle_config), pod status transitions to 'active'
  Roles: Participant (active or inactive, enrolled in cycle)

DELETE /api/pods/{pod_id}/register
  Input: { participant_id }
  Output: { success }
  Purpose: Withdraw from a pod registration
  Auth: JWT
  Window: pod_registration_open / pod_registration_close — 403 "Pod registration is not currently open."
  Roles: Participant (own registration only); Admin, Owner (any registration)
```

### Solution Proposal Submission (Phase 4)
```
POST /api/pods/{pod_id}/solution-proposals
  Input: { participant_id, proposal_text }
  Output: { id, created_at }
  Purpose: Submit a solution proposal scoped to a pod
  Auth: JWT
  Window: solution_proposal_open / solution_proposal_close — 403 "Solution proposal submission is not currently open."
  Validation: participant must have an active pod membership (`pod_memberships.inactive_at IS NULL` for this pod)
  Roles: Participant (active pod member only)

GET /api/pods/{pod_id}/solution-proposals
  Output: [ { id, participant_id, proposal_text, created_at } ]
  Auth: JWT
  Purpose: View all submitted proposals for a pod
  Roles: Participant (active, pod member); Moderator (assigned pod); Admin, Owner
```

### Solution Voting (Phase 5)
```
POST /api/pods/{pod_id}/project-votes
  Input: { voter_id, solution_proposal_id, vote_count }
  Output: { id, created_at, votes_remaining }
  Purpose: Allocate votes to a solution proposal within a pod
  Auth: JWT
  Window: solution_voting_open / solution_voting_close — 403 "Solution voting is not currently open."
  Validation:
    - voter must have an active pod membership (`pod_memberships.inactive_at IS NULL` for this pod)
    - solution_proposal_id must belong to pod_id
    - vote_count >= 1
    - voter's total allocated votes for this pod must not exceed project_submitter_votes (cycle_config)
  Notes:
    - Active pod membership is determined by pod_memberships.inactive_at, not cycle_enrollments.status
    - All active pod members receive the same budget regardless of whether they submitted a proposal
  Roles: Participant (active pod member only)

GET /api/pods/{pod_id}/project-votes
  Output: {
    votes: [ { voter_id, solution_proposal_id, vote_count } ],
    tallies: [ { solution_proposal_id, total_votes } ]  -- sorted descending
  }
  Auth: JWT
  Purpose: View vote tallies for a pod's solution proposals
  Roles: Moderator (assigned pod), Admin, Owner
```

### Project Formation (Phase 6)
```
POST /api/pods/{pod_id}/projects/finalize
  Input: {}
  Output: {
    projects: [ { id, name, solution_proposal_id, total_votes } ],
    eligible_proposals: [ { solution_proposal_id, total_votes, rank } ],
    ineligible_proposals: [ { solution_proposal_id, total_votes } ]
  }
  Purpose:
    1. Tally total votes per solution proposal within the pod
    2. Filter to proposals with total_votes >= project_vote_threshold (cycle_config)
    3. Rank eligible proposals by total votes descending; ties broken by submission time
    4. Create up to max_projects projects (cycle_config) from the top-ranked eligible proposals
    5. For each created project, call the name generation service with the associated solution proposal text;
       write the result to projects.name. Fallback: first 40 characters of proposal text, trimmed to nearest word.
  Auth: Admin JWT
  Notes:
    - Scoped strictly to pod_id — only votes and proposals within this pod are counted
    - Tie-breaking: submission time (earliest first)
    - Call after solution voting window closes for this pod
  Roles: Admin, Owner, Moderator (assigned pod)
```

### Name Overrides
```
PATCH /api/pods/{pod_id}/name
  Input: { name }
  Output: { id, name, updated_at }
  Purpose: Manually override an auto-generated pod name
  Auth: JWT
  Validation: name must be 3 words or fewer and 40 characters or fewer
  Roles: Admin, Owner, Moderator (assigned pod only)

PATCH /api/projects/{project_id}/name
  Input: { name }
  Output: { id, name, updated_at }
  Purpose: Manually override an auto-generated project name
  Auth: JWT
  Validation: name must be 3 words or fewer and 40 characters or fewer
  Roles: Admin, Owner, Moderator (assigned pod only)
```

### Project Registration (Phase 7)
```
POST /api/projects/{project_id}/register
  Input: { participant_id }
  Output: { project_membership_id, registered_at }
  Purpose: Self-register for a project
  Auth: JWT
  Window: project_registration_open / project_registration_close — 403 "Project registration is not currently open."
  Validation:
    - participant must be an active member of the project's parent pod → 400 "You must be an active member of this pod to register."
    - participant must not already have an active project_membership in this cycle → 400 "You are already registered in a project for this cycle. Withdraw first to register for a different project."
    - project registrant count must not already be at project_max (cycle_config) → 400 "This project has reached its maximum registrant count."
  Roles: Participant (active, pod member only)

DELETE /api/projects/{project_id}/register
  Input: { participant_id }
  Output: { success }
  Purpose: Withdraw from a project registration
  Auth: JWT
  Window: project_registration_open / project_registration_close — 403 "Project registration is not currently open."
  Roles: Participant (own registration only); Admin, Owner (any registration)

GET /api/projects/{project_id}
  Output: {
    id, name, solution_proposal_id, pod_id, total_votes, status,
    registrants: [ { participant_id, name, registered_at } ],
    registrant_count, min_required, max_allowed
  }
  Auth: JWT
  Roles: Participant (active, pod member); Moderator (assigned pod); Admin, Owner
```

### Pulse Checks
```
POST /api/pulse-checks
  Input: { cycle_id, participant_id, survey_responses }
  Output: { id, completed_at }
  Purpose: Custom pulse check form submission
  Auth: JWT
  Window: None — pulse checks have no open/close window and are always open during an active cycle.
          Each submission is associated with a scheduled_date (the Sunday send date for that week).
          Do not add window enforcement to this endpoint.
  Roles: Participant (active, own records only)

GET /api/pulse-checks/{cycle_id}?participant_id={participant_id}
  Output: [ { scheduled_date, completed_at, survey_responses } ]
  Auth: JWT
  Roles: Participant (own records only); Moderator (participants in assigned pods); Admin, Owner (any participant)

POST /api/pulse-checks/send/{cycle_id}
  Input: {}
  Output: { sent_count, sent_to }
  Purpose: Scheduled job—send pulse check forms to all active cycle enrollees
  Auth: Admin JWT
  Roles: Admin, Owner
```

### Access Revocation
```
POST /api/revocations/check/{cycle_id}
  Input: {}
  Output: { 
    transitioned_to_inactive: [ { participant_id, reason, revocation_scope, systems_affected } ]
  }
  Purpose:
    Identify participants who have gone inactive (missed 2+ consecutive pulse checks OR not in any pod),
    then apply the inactive access profile:
      - GitHub: downgrade to viewer (not collaborator) on pod/project repos
      - Google Drive: downgrade to viewer (not editor) on pod/project folders
      - Slack: remove from all pod channels and project channels
      - project_memberships: revoke (set left_at)
      - pod_memberships: retain but mark inactive (set inactive_at)
      - cycle_enrollments: set status = 'inactive', populate inactive_date
    Records a row in access_revocations per participant with revocation_scope = 'full'
  Auth: Admin JWT
  Notes: Calls Slack/Drive/GitHub APIs to apply access changes
  Roles: Admin, Owner

GET /api/revocations/{cycle_id}
  Output: [ { participant_id, reason, revocation_scope, revoked_at, systems } ]
  Auth: Admin JWT
  Roles: Admin, Owner

POST /api/revocations/reactivate/{participant_id}
  Input: { cycle_id }
  Output: { success, participant_id, restored_pods: [pod_ids], restored_projects: [project_ids], restored_systems: ['slack', 'drive', 'github'] }
  Purpose: Restore a participant to active status and reinstate all access that was revoked.
  Auth: Admin JWT
  Roles: Admin, Owner
  Steps:
    1. Set cycle_enrollments.status = 'active', clear inactive_date for this participant + cycle
    2. Restore all pod memberships: set pod_memberships.inactive_at = NULL for all pod_memberships
       belonging to this participant in this cycle (regardless of pod status — restore even if pod
       is inactive or closed)
    3. Restore all project memberships: set project_memberships.left_at = NULL for all
       project_memberships belonging to this participant in this cycle (regardless of project
       status — restore even if project is inactive or closed)
    4. Slack: re-add participant to all pod channels and project channels they were previously
       in (source from pod_memberships and project_memberships restored in steps 2 and 3)
    5. Google Drive: restore editor permissions on all pod and project Drive folders they
       previously had access to
    6. GitHub: restore collaborator access on all pod and project repositories they previously
       had access to
    7. Create an access_revocations row with reason = 'reactivated' and revocation_scope = 'full'
       to record the reactivation event in the audit trail
  Notes:
    - Restores to all pods and projects the participant was previously in, regardless of current
      pod/project status
    - If any external API call (Slack, Drive, GitHub) fails, log the failure but do not block
      the reactivation — return a warning in the response indicating which systems failed
    - Partial success is acceptable; status flag and memberships are always restored even if
      external API calls fail
```

### Dashboard
```
GET /api/dashboard/{cycle_id}
  Output: {
    cycle_name,
    total_enrolled,
    active_participants,
    pods: [
      { id, name, member_count, active_count, revoked_count }
    ],
    pulse_check_status: {
      sent_count,
      completed_count,
      completion_rate
    },
    recent_revocations: [ { participant_id, reason, revoked_at } ]
  }
  Auth: JWT
  Roles: Admin, Owner, Observer (full view across all cycles); Moderator (scoped to assigned pods); Participant (active, own pod summary only)

GET /api/dashboard/{cycle_id}/pods/{pod_id}
  Output: {
    pod_name,
    problem_statement,
    members: [ { participant_id, name, status, last_pulse_check } ],
    activity_log
  }
  Auth: JWT
  Roles: Admin, Owner, Observer; Moderator (assigned pods only); Participant (active, own pod only)
```

---

## Data Flow

### Registration
1. Participant fills the custom registration form (public, no authentication required)
2. Form submits directly to `POST /api/registrations`
3. Backend creates `participants` row + `cycle_enrollments` row with `status = 'inactive'`
4. Participant is inactive by default until they join a pod and complete pulse checks

### Phase 1: Problem Statement Submission
1. Submission window opens
2. Participant fills the custom problem statement form (authenticated)
3. Form submits directly to `POST /api/problem-statements`
4. Backend creates `problem_statements` row (submission status is derived from this table — no separate flag)
5. Submission window closes

### Phase 2: Problem Statement Voting
1. Voting window opens
2. Participants review all submitted problem statements
3. Each participant allocates votes across any statements using their budget:
   - Submitted a statement: `submitter_votes` budget (cycle_config, default 3)
   - Did not submit: `non_submitter_votes` budget (cycle_config, default 1)
   - Votes can be split across multiple statements or concentrated on one
4. For each allocation: `POST /api/votes` with `{ cycle_id, voter_id, problem_statement_id, vote_count }`
5. Backend validates total allocated votes do not exceed budget, stores `votes` row
6. Voting window closes

### Phase 3: Pod Shortlist Finalization
1. Admin calls `POST /api/voting/finalize/{cycle_id}` after voting closes
2. Backend:
   - Tallies total votes per statement (`SUM(vote_count)` grouped by `problem_statement_id`)
   - Filters to statements with `total_votes >= vote_threshold` (cycle_config, default 5)
   - Ranks eligible statements by total votes descending; ties broken by submission time
   - Creates up to `max_pods` pods (cycle_config, default 8) in `forming` status — pod shortlist is published
3. Pod registration window opens

### Phase 3b: Pod Self-Registration
1. Participants browse the pod shortlist and self-register via `POST /api/pods/{pod_id}/register`
2. Backend enforces on each registration attempt:
   - Pod must be in `forming` or `active` status
   - Participant must not already have 2 active `pod_memberships` in this cycle (2-pod-per-cycle cap)
   - Participant must not already be registered for this pod
3. Once a pod's active registrant count reaches `pod_min` (cycle_config, default 5), it transitions to `active` status
4. There is no maximum pod size — registration remains open beyond `pod_min`
5. Participants may withdraw via `DELETE /api/pods/{pod_id}/register` at any time during the registration window
6. Registration window closes; pods with `registrant_count < pod_min` remain in `forming` status (ineligible for downstream phases)

### Phase 4: Solution Proposal Submission (within Pod)
1. Solution submission window opens (per pod, after pod formation)
2. Active pod members submit solution proposals via `POST /api/pods/{pod_id}/solution-proposals`
3. Only active pod members (`pod_memberships.inactive_at IS NULL`) may submit
4. Backend creates `solution_proposals` row scoped to `pod_id` and `cycle_id`
5. Submission window closes

### Phase 5: Solution Voting (within Pod)
1. Solution voting window opens (per pod)
2. All active pod members review proposals submitted within their pod
3. Each active pod member receives a flat budget of `project_submitter_votes` (cycle_config, default 3) — no differentiation for submitters vs. non-submitters
4. Votes can be split across proposals or concentrated on one
5. For each allocation: `POST /api/pods/{pod_id}/project-votes` with `{ voter_id, solution_proposal_id, vote_count }`
6. Backend validates:
   - Voter has an active pod membership (`pod_memberships.inactive_at IS NULL` for this pod)
   - `solution_proposal_id` belongs to this pod
   - Total allocated votes do not exceed `project_submitter_votes`
7. Voting is scoped strictly within the pod — members only vote on proposals within their own pod
8. Voting window closes

### Phase 6: Project Formation (within Pod)
1. Moderator or Admin calls `POST /api/pods/{pod_id}/projects/finalize` after voting closes
2. Backend:
   - Tallies total votes per proposal (`SUM(vote_count)` grouped by `solution_proposal_id`)
   - Filters to proposals with `total_votes >= project_vote_threshold` (cycle_config, default 5)
   - Ranks eligible proposals by total votes descending; ties broken by submission time
   - Creates up to `max_projects` projects (cycle_config, default 8) from the top-ranked eligible proposals
   - Publishes shortlist — projects enter `forming` status
3. Output: formed projects + full vote tally (eligible and ineligible)

### Phase 7: Project Self-Registration (within Pod)
1. Registration window opens after project shortlist is published
2. Active pod members self-register for projects via `POST /api/projects/{project_id}/register`
3. Backend enforces on each registration attempt:
   - Participant is an active member of the project's parent pod
   - Participant does not already have an active `project_membership` in this cycle (1-project-per-cycle rule, enforced by partial unique index)
   - Project registrant count has not reached `project_max` (cycle_config, default 7)
4. Participants may withdraw via `DELETE /api/projects/{project_id}/register` and re-register for a different project (subject to caps)
5. Once a project reaches `project_min` registrants (cycle_config, default 3), it becomes eligible to activate
6. Registration window closes; projects with `registrant_count >= project_min` activate

### Weekly Pulse Checks
1. Sunday night: admin or scheduled job calls `POST /api/pulse-checks/send/{cycle_id}`
2. Backend queries active `cycle_enrollments`, sends notification (email or Slack) with a link to the pulse check form
3. Participant completes the custom pulse check form during the week
4. Form submits directly to `POST /api/pulse-checks` with responses
5. Dashboard updates completion rate

### Access Revocation (Automated)
A participant transitions to inactive when either condition is true:
- They miss 2+ consecutive pulse checks, OR
- They are not registered in any active pod

**Inactive access profile:**
- GitHub repos: downgraded from collaborator to viewer
- Google Drive folders: downgraded from editor to viewer
- Slack: removed from all pod channels and project channels
- Project memberships: revoked (`project_memberships.left_at` set)
- Pod memberships: retained but marked inactive (`pod_memberships.inactive_at` set)
- Enrollment: `cycle_enrollments.status = 'inactive'`, `inactive_date` populated

1. Scheduled job (e.g., Monday) calls `POST /api/revocations/check/{cycle_id}`
2. Backend:
   - Queries `cycle_enrollments` for all active participants in cycle
   - Checks each participant against both inactivity conditions:
     a. Missed pulse checks: 2+ consecutive `pulse_checks` rows with `completed_at IS NULL`
     b. No active pod: no `pod_memberships` row with `inactive_at IS NULL`
   - For each participant triggering either condition:
     - Downgrade GitHub permissions to viewer on all pod/project repos
     - Downgrade Drive permissions to viewer on all pod/project folders
     - Call Slack API to remove from all pod channels and project channels
     - Revoke all active `project_memberships` (set `left_at = now()`)
     - Mark all active `pod_memberships` inactive (set `inactive_at = now()`)
     - Set `cycle_enrollments.status = 'inactive'`, `inactive_date = now()`
     - Create `access_revocations` row with `revocation_scope = 'full'`
3. Dashboard reflects inactive status

### Reactivation Flow
When an admin calls `POST /api/revocations/reactivate/{participant_id}`:

1. `cycle_enrollments.status` is set back to `'active'` and `inactive_date` is cleared
2. All `pod_memberships` for this participant in this cycle are restored (`inactive_at` set to `NULL`)
3. All `project_memberships` for this participant in this cycle are restored (`left_at` set to `NULL`)
4. Slack, Drive, and GitHub access is reinstated for all pods and projects from the restored memberships
5. Reactivation is recorded in `access_revocations` (reason = `'reactivated'`, revocation_scope = `'full'`) for audit purposes

Restoration applies regardless of current pod or project status. If an external API call fails, the failure is logged and returned as a warning but does not block the reactivation.

---

## Tech Decisions

### Database: PostgreSQL
- Native JSON support (JSONB for survey responses)
- UNIQUE constraints for vote deduplication
- Timestamps for audit trail

### Backend: Python/FastAPI
- Fast, async, minimal boilerplate
- Easy webhook validation + signature verification
- Built-in dependency injection for DB connections

### Custom Forms
All data collection uses custom-built React forms that are part of the application and submit directly to the API. No webhook routing or third-party form tools required.

Forms to build:
- **Participant registration** → `POST /api/registrations` (public, pre-auth)
- **Problem statement submission** → `POST /api/problem-statements` (authenticated)
- **Pod self-registration** → `POST /api/pods/{pod_id}/register` (authenticated)
- **Solution proposal submission** → `POST /api/pods/{pod_id}/solution-proposals` (authenticated)
- **Project self-registration** → `POST /api/projects/{project_id}/register` (authenticated)
- **Weekly pulse check** → `POST /api/pulse-checks` (authenticated)

### Name Generation
Pod and project names are auto-generated from their associated problem statement or solution proposal text using an LLM call at formation time.

- **Model:** `claude-haiku-4-5-20251001` — cheap and fast; this is a short generation task
- **Prompt:** Pass the full statement or proposal text; instruct the model to return a short, human-readable name: 3 words maximum, title case, no punctuation, descriptive of the core problem or solution
- **Character limit:** 40 characters maximum, enforced after generation; truncate to nearest word if exceeded
- **Auto-accepted:** The generated name is written directly to `pods.name` or `projects.name` at formation time with no approval step
- **Fallback:** If the LLM call fails, use the first 40 characters of the source text, trimmed to the nearest word
- **Override:** Admin or Moderator can manually override the name at any time via `PATCH /api/pods/{pod_id}/name` or `PATCH /api/projects/{project_id}/name`

### Stack Voting
- No external library required; implemented directly in the backend
- Tally query: `SELECT problem_statement_id, SUM(vote_count) AS total_votes FROM votes WHERE cycle_id = ? GROUP BY problem_statement_id ORDER BY total_votes DESC`
- Eligibility filter and pod cap use `vote_threshold` and `max_pods` from `cycle_config` — no hardcoded constants

---

## External API Integrations

The revocation and reactivation flows integrate with three external platforms. These integrations are required for access management and must be implemented as part of the revocation endpoints.

### Slack (free plan)
- Library: `slack_sdk`
- Requires a bot token with channel management scopes
- Used to add/remove participants from pod and project Slack channels
- **Dependency to verify:** Confirm free-tier Slack API access supports programmatic channel membership management at the required scale before building integration logic.

### Google Drive (Google Workspace)
- Libraries: `google-auth`, `google-api-python-client`
- Requires a service account with Drive API access
- Used to manage file permissions (editor ↔ viewer) on pod and project Drive folders
- **Dependency to verify:** Confirm Google Workspace API access supports programmatic permission management at the required scale before building integration logic.

### GitHub (free plan)
- Library: `PyGithub`
- Requires a personal access token or GitHub App token with repo collaborator scopes
- Used to add/remove collaborators on pod and project repositories
- **Dependency to verify:** Confirm free-tier GitHub API access supports programmatic collaborator management at the required scale before building integration logic.

### Environment Variables
```
SLACK_BOT_TOKEN=
GOOGLE_SERVICE_ACCOUNT=
GITHUB_TOKEN=
ANTHROPIC_API_KEY=  # used for pod/project name generation and any other LLM calls in the application
```

---

## MVP Scope (Week 1)

### Must-Have
- [ ] PostgreSQL schema + seed data (including `cycle_config` with all project-layer config values)
- [ ] FastAPI backend with auth (Google OAuth)
- [ ] Registration form + endpoint
- [ ] Problem statement form + endpoint (Phase 1)
- [ ] Stack voting endpoint with budget validation (Phase 2)
- [ ] Vote tally + pod formation endpoint (Phase 3)
- [ ] Solution proposal submission endpoint (Phase 4)
- [ ] Solution voting endpoint with budget validation (Phase 5)
- [ ] Project formation endpoint per pod (Phase 6)
- [ ] Project self-registration endpoints with cap + 1-project-per-cycle enforcement (Phase 7)
- [ ] Pulse check form + endpoint
- [ ] Access revocation check logic (identify users missing 2+ checks)
- [ ] Basic dashboard (active users, pod status, pulse completion)

### Nice-to-Have (Week 2+)
- [ ] Slack/Drive/GitHub API integration for revocation
- [ ] Email notifications
- [ ] Audit logs
- [ ] Admin UI for manual overrides

### Out of Scope (for now)
- [ ] User profile editing
- [ ] Advanced analytics
- [ ] Mobile app

---

## UI Specifications

### Voting Dashboard (Pod Voting & Project Voting Phases)

- Visible to all enrolled participants, moderators, admins, and observers during the active voting window
- Updates near real-time (polling acceptable; websockets not required)
- Each statement/proposal displayed as a bar showing total votes received
- A visible threshold line marks the minimum votes required for eligibility (`vote_threshold` for pod voting; `project_vote_threshold` for project voting)
- For project voting only: display a second indicator showing the `project_max` registrant cap
- Statements are shown by title only — no author attribution displayed
- Bars ordered by current vote count, highest first

### Cycle Dashboard

- Updates near real-time (polling acceptable)
- Role-based visibility:
  - **Admin, Owner, Observer:** full view of all pods, all projects, and all participants across the cycle
  - **Moderator:** view of their assigned pods and all projects within those pods
  - **Active Participant:** view of their own pod(s) and all projects within those pods only
- **Per pod:** pod name, problem statement title, member list with active/inactive status, inactivation date for inactive members
- **Per project:** project name, solution statement title, member list with active/inactive status, inactivation date for inactive members

---

## Questions to Lock Down

1. **Stack vote tie-breaking:** If 2 statements receive the same total votes, what's the tiebreaker? (Spec currently defaults to submission time — earliest first. Confirm or override.)
2. **Window enforcement ✓ resolved:** The API enforces all submission windows server-side using the open/close timestamps in `cycle_config`. Requests outside a window return `403 Forbidden`. `NULL` timestamps are treated as unscheduled and also return `403`. No admin overrides exist. Pulse checks are exempt — they have no window and are always open during an active cycle.
3. **Name generation ✓ resolved:** Pod and project names are auto-generated at formation time via LLM call (`claude-haiku-4-5-20251001`), using the associated problem statement or solution proposal text as input. Format: 3 words max, 40 characters max, title case, no punctuation. Auto-accepted with no approval step. Can be manually overridden by Admin or Moderator via `PATCH` endpoints.
4. **Reactivation flow ✓ resolved:** Reactivation flips `cycle_enrollments.status` back to `active` and fully restores all access — pod memberships, project memberships, Slack channels, Drive folders, and GitHub repos — to exactly what the participant had before revocation. Applies regardless of current pod or project status. External API failures are logged and surfaced as warnings but do not block reactivation. Partial success is acceptable.
5. **Moderator assignments ✓ resolved:** Assignments are scoped to a cycle and made by admins only. A moderator can be assigned to multiple pods within the same cycle. Assignments can only be made after a pod exists (status = `'forming'` or later). Removal sets `removed_at` and immediately cuts off data visibility. Assignment and removal are recorded for audit purposes — rows are never deleted.
6. **Pulse check survey fields:** What are the specific questions on the weekly pulse check? (Affects both UI form fields and the JSON schema for `survey_responses`.)

