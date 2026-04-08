# The Upskilling Labs (TUL) — WIN Challenge MVP Spec

## Overview
Build a system to manage **4 core touchpoints** across a Build Cycle and reduce manual effort to coordinate Upskillers in a cycle.
1. Participant registration (Form → DB)
2. Problem statement submission + ranked choice voting (Form → DB → ranked choice algorithm → pods)
3. Weekly pulse checks (Form → DB)
4. Access revocation automation (Slack, Drive, GitHub)

**Stack:** PostgreSQL, Python/FastAPI, Form + webhooks, custom React dashboard

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
  status VARCHAR(50) DEFAULT 'active',  -- 'active', 'inactive', 'revoked'
  UNIQUE(participant_id, cycle_id)
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
  weight INT DEFAULT 1,  -- 1, 2, or 3 based on whether voter submitted a statement
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
  name VARCHAR(255),  -- human-readable pod name
  slack_channel_id VARCHAR(255),
  github_repo_url VARCHAR(255),
  drive_folder_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `pod_memberships`
```sql
CREATE TABLE pod_memberships (
  id SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id),
  pod_id INT NOT NULL REFERENCES pods(id),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP,  -- NULL = active; non-null = revoked (timestamp of revocation)
  UNIQUE(participant_id, pod_id)
);
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
  reason VARCHAR(255),  -- e.g., 'missed_2_pulse_checks'
  revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_systems TEXT[] DEFAULT ARRAY[]::TEXT[]  -- e.g., ['slack', 'drive', 'github']
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
```

### Option Lists
```
GET /api/options
  Output: { ai_tools: [{id, value}], labs_goals: [{id, value}], availability: [{id, value}], work_style: [{id, value}], group_strengths: [{id, value}] }
  Purpose: Populate multiselect dropdowns on the registration form
  Auth: None (public)

POST /api/options
  Input: { list_name, value, display_order? }
  Output: { id, list_name, value }
  Purpose: Add a new option to a list
  Auth: Admin JWT

PATCH /api/options/{option_id}
  Input: { active?, display_order? }
  Purpose: Retire or reorder an option (never hard-delete — historical data references it)
  Auth: Admin JWT
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
  Purpose: Webhook endpoint for Form submissions
  Auth: Webhook signature validation (or secret key)

GET /api/participants/{participant_id}
  Output: {
    id, email, first_name, last_name, preferred_name,
    state, neighborhood, work_situation, main_focus,
    ai_tool_familiarity,
    ai_tools: [{ id, value }], labs_goals: [{ id, value }],
    availability: [{ id, value }], work_style: [{ id, value }],
    group_strengths: [{ id, value }],
    participation_commitment, problem_statement_submitted
  }
  Auth: JWT
```

### Problem Statement Submission (Phase 1)
```
POST /api/problem-statements
  Input: { cycle_id, participant_id, statement_text }
  Output: { id, created_at }
  Purpose: Webhook from Form (submission window)
  Auth: Webhook signature
  Side effect: Sets problem_statement_submitted = true on participant

GET /api/problem-statements/{cycle_id}
  Output: [ { id, participant_id, statement_text } ]
  Auth: JWT
  Purpose: View all submitted statements (for reference during voting phase)
```

### Problem Statement Voting (Phase 2)
```
POST /api/votes
  Input: { cycle_id, voter_id, ranked_choices: [problem_statement_id, ...] }
  Output: { id, created_at }
  Purpose: Webhook from Form (voting window) OR manual API
  Auth: Webhook signature or JWT
  Notes: 
    - voter gets 3 votes if problem_statement_submitted=true, else 1
    - ranked_choices is ordered list (1st choice gets weight 3, 2nd gets weight 2, etc.)
    - OR store individual votes per choice with descending weights

GET /api/votes/{cycle_id}
  Output: [ { voter_id, problem_statement_id, weight, choice_rank } ]
  Auth: JWT
  Purpose: View vote tallies (admin only)
```

### Pod Creation & Assignment (Phase 3)
```
POST /api/voting/finalize/{cycle_id}
  Input: {}
  Output: { 
    pods: [ 
      { id, name, problem_statement_id, members: [participant_ids], member_count, status: 'active'|'inactive' } 
    ],
    unassigned_participants: [participant_ids]
  }
  Purpose: 
    1. Run ranked choice on all votes
    2. For each top N statement (ordered by ranked choice score):
       a. Create pod
       b. Assign participants whose top vote matches this statement
       c. If top vote pod < 6 members, re-assign to their 2nd choice
       d. Repeat until all participants assigned or votes exhausted
    3. Mark pods with >= 6 members as 'active'
    4. Return unassigned participants (if any)
  Auth: Admin JWT
  Notes: 
    - Pods only become active once they hit 6 members
    - Call after voting window closes
    - Tie-breaking: submission time (earliest first) OR admin picks
```

### Overflow Assignment (Phase 4)
```
POST /api/voting/assign-overflow/{cycle_id}
  Input: {}
  Output: { 
    assigned_participants: [ { participant_id, pod_id, reason: 'overflow' } ],
    still_unassigned: [participant_ids]
  }
  Purpose: 
    1. Query all participants not yet assigned to any pod
    2. For each unassigned participant:
       a. Find their highest-ranked vote that corresponds to an active pod
       b. Assign them to that active pod
    3. Return newly assigned participants + any still unassigned (if all their votes were to inactive pods)
  Auth: Admin JWT
  Notes: 
    - Run after Phase 3
    - Only assigns to active pods (those with >= 6 members)
    - If participant's all votes are to inactive pods, they remain unassigned
```

### Pulse Checks
```
POST /api/pulse-checks
  Input: { cycle_id, participant_id, survey_responses }
  Output: { id, completed_at }
  Purpose: Webhook from Form
  Auth: Webhook signature

GET /api/pulse-checks/{cycle_id}?participant_id={participant_id}
  Output: [ { scheduled_date, completed_at, survey_responses } ]
  Auth: JWT

POST /api/pulse-checks/send/{cycle_id}
  Input: {}
  Output: { sent_count, sent_to }
  Purpose: Scheduled job—send pulse check forms to all active cycle enrollees
  Auth: Admin JWT
```

### Access Revocation
```
POST /api/revocations/check/{cycle_id}
  Input: {}
  Output: { revoked_participants: [ { participant_id, reason, systems_removed } ] }
  Purpose: Identify participants missing 2+ consecutive pulse checks, revoke access
  Auth: Admin JWT
  Notes: Calls Slack/Drive/GitHub APIs to remove participants

GET /api/revocations/{cycle_id}
  Output: [ { participant_id, reason, revoked_at, systems } ]
  Auth: Admin JWT

POST /api/revocations/reactivate/{participant_id}
  Input: { cycle_id }
  Output: { success, message }
  Purpose: Reactivate participant access (re-add to Slack, Drive, GitHub)
  Auth: Admin JWT
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

GET /api/dashboard/{cycle_id}/pods/{pod_id}
  Output: {
    pod_name,
    problem_statement,
    members: [ { participant_id, name, status, last_pulse_check } ],
    activity_log
  }
  Auth: JWT
```

---

## Data Flow

### Registration
1. User fills Form
2. Webhook → `POST /api/registrations`
3. Backend creates `participants` row + `cycle_enrollments` row

### Phase 1: Problem Statement Submission
1. Submission window opens
2. User fills Form with problem statement
3. Webhook → `POST /api/problem-statements`
4. Backend creates `problem_statements` row + sets `problem_statement_submitted = true` flag on participant
5. Submission window closes

### Phase 2: Problem Statement Voting
1. Voting window opens
2. User fills Form with ranked choices (1st choice, 2nd choice, etc.)
3. Webhook → `POST /api/votes` with ordered ranked_choices
4. Backend stores individual votes with descending weights (1st = weight 3, 2nd = weight 2, etc.)
5. Voting window closes

### Phase 3: Pod Creation & Assignment
1. Admin calls `POST /api/voting/finalize/{cycle_id}` after voting closes
2. Backend:
   - Runs ranked choice algorithm on all votes
   - For each top N statement (ordered by ranked choice score):
     a. Create `pods` row
     b. Query all users whose 1st vote = this statement, assign to `pod_memberships`
     c. If pod has < 6 members, re-query users whose 2nd vote = this statement, assign them
     d. Repeat for 3rd choice, etc. until pod has 6+ members or no more voters
     e. If pod reaches 6+ members, mark status = 'active'
     f. If pod never reaches 6 members, mark status = 'inactive'
   - Unassigned users returned in response
3. Output: list of active + inactive pods with member assignments

### Phase 4: Overflow Assignment
1. Admin calls `POST /api/voting/assign-overflow/{cycle_id}` after Phase 3
2. Backend:
   - Queries all users not assigned to any pod (from Phase 3)
   - For each unassigned user, finds their highest-ranked vote that corresponds to an active pod
   - Assigns them to that active pod via `pod_memberships`
   - Returns newly assigned users + any still unassigned (if all their votes were to inactive pods)
3. Output: overflow assignments + final unassigned list

### Weekly Pulse Checks
1. Sunday night: admin or scheduled job calls `POST /api/pulse-checks/send/{cycle_id}`
2. Backend queries active `cycle_enrollments`, generates form links, sends emails/Slack
3. User completes form during the week
4. Webhook → `POST /api/pulse-checks` with responses
5. Dashboard updates completion rate

### Access Revocation (Automated)
1. Scheduled job (e.g., Monday) calls `POST /api/revocations/check/{cycle_id}`
2. Backend:
   - Queries `pulse_checks` for each active user in cycle
   - Identifies users with 2+ consecutive missed checks
   - For each revoked user:
     - Calls Slack API to remove from pod channel
     - Calls Google Drive API to remove from pod folder
     - Calls GitHub API to remove from pod repo
     - Creates `access_revocations` row
     - Sets `pod_memberships.revoked_at`
3. Dashboard reflects revoked status

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

### Form Layer: Forms + Webhooks
- **Registration:** Form → webhook to `POST /api/registrations`
- **Problem statements:** Form → webhook to `POST /api/problem-statements`
- **Pulse checks:** Form → webhook to `POST /api/pulse-checks`
- **Voting:** Either Form OR custom React form, depending on UX preference

### Ranked Choice Voting Library
- Python: `instant-runoff` (PyPI) or `ranked-choice` (PyPI)
- Lightweight, no heavy dependencies
- Takes votes as input, returns ranked results

### Access Revocation Automation
- **Slack API:** Use `slack_sdk` to remove users from channels
- **Google Drive API:** Use `google-auth` + `google-api-python-client` to remove file permissions
- **GitHub API:** Use `PyGithub` to remove collaborators from repos

---

## MVP Scope (Week 1)

### Must-Have
- [ ] PostgreSQL schema + seed data
- [ ] FastAPI backend with auth (Google OAuth)
- [ ] Registration webhook + endpoint
- [ ] Problem statement webhook + endpoint (Phase 1)
- [ ] Voting endpoint (Phase 2)
- [ ] Ranked choice algorithm endpoint (Phase 3)
- [ ] Pod creation logic (Phase 3)
- [ ] Overflow assignment endpoint (Phase 4)
- [ ] Pulse check webhook + endpoint
- [ ] Access revocation check logic (identify users missing 2+ checks)
- [ ] Basic dashboard (active users, pod status, pulse completion)

### Nice-to-Have (Week 2+)
- [ ] Custom React form UI
- [ ] Slack/Drive/GitHub API integration for revocation
- [ ] Email notifications
- [ ] Audit logs
- [ ] Admin UI for manual overrides

### Out of Scope (for now)
- [ ] User profile editing
- [ ] Advanced analytics
- [ ] Mobile app

---

## Questions to Lock Down

1. **Ranked choice tie-breaking:** If 2 statements end with same vote count, what's tiebreaker? (submission time, random, admin pick?)
2. **Pod size:** Do you want balanced pods (e.g., 5 people each) or just form around top N statements?
3. **Re-enrollment:** Can revoked users re-enroll mid-cycle or only next cycle?
4. **Pulse check survey fields:** What are the actual questions? (Affects JSON schema for `survey_responses`.)
5. **Google Form webhook setup:** Do you know how to set up Zapier/Make/n8n to forward form responses to your backend URL?

