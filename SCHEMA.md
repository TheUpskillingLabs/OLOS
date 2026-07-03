# OLOS Database Schema

Single PostgreSQL database. 18 tables organized around a **Cycle → Pod → Project** hierarchy.

---

## Lifecycle Overview

```mermaid
flowchart TD
    A([Cycle Created]) --> B[Problem Statement Submission]
    B --> C[Pod-Level Voting]
    C --> D{Shortlisted?}
    D -- yes --> E[Pod Forms]
    D -- no --> X1([Statement Archived])
    E --> F{Reached pod_min?}
    F -- yes --> G[Pod Active]
    F -- no --> X2([Pod Inactive])
    G --> H[Solution Proposal Submission]
    H --> I[Project-Level Voting]
    I --> J{Shortlisted?}
    J -- yes --> K[Project Forms]
    J -- no --> X3([Proposal Archived])
    K --> L{Reached project_min?}
    L -- yes --> M([Project Active])
    L -- no --> X4([Project Inactive])

    style M fill:#2d6a4f,color:#fff
    style X1 fill:#6b2737,color:#fff
    style X2 fill:#6b2737,color:#fff
    style X3 fill:#6b2737,color:#fff
    style X4 fill:#6b2737,color:#fff
```

---

## ERD — Core & Configuration

`cycles` is the root of everything. `cycle_config` holds all tunable thresholds and window timestamps for a given cycle. `participants` is the system-wide identity table.

```mermaid
erDiagram
    cycles {
        int id PK
        varchar name
        varchar slug UK
        timestamp start_date
        timestamp end_date
        varchar status
    }

    cycle_config {
        int id PK
        int cycle_id FK
        smallint submitter_votes
        smallint non_submitter_votes
        smallint vote_threshold
        smallint max_pods
        smallint pod_min
        smallint project_submitter_votes
        smallint project_vote_threshold
        smallint max_projects
        smallint project_min
        smallint project_max
        timestamp problem_statement_open
        timestamp problem_statement_close
        timestamp voting_open
        timestamp voting_close
        timestamp pod_registration_open
        timestamp pod_registration_close
        timestamp solution_proposal_open
        timestamp solution_proposal_close
        timestamp solution_voting_open
        timestamp solution_voting_close
        timestamp project_registration_open
        timestamp project_registration_close
        timestamp updated_at
    }

    participants {
        int id PK
        varchar google_id UK
        varchar email UK
        varchar first_name
        varchar last_name
        varchar preferred_name
        varchar gender
        varchar state "nullable"
        varchar neighborhood "nullable"
        varchar phone_number
        varchar dcpl_card "nullable"
        boolean dcpl_info
        varchar work_situation "nullable"
        varchar main_focus "nullable"
        varchar sector
        varchar current_title
        varchar linkedin
        smallint ai_tool_familiarity "nullable"
        varchar participation_commitment
        varchar primary_expertise
        varchar volunteer_interest
        text availability_notes
        text commitment_notes
        text interest_areas
        text moderator_experience
        boolean text_updates "nullable"
        boolean email_updates
        boolean comms_consent
        boolean contact_consent "NOT NULL DEFAULT FALSE"
        boolean photo_video_consent
        varchar source
        varchar referred_by
        varchar zip
        varchar metro_slug
        text_array role_intents "NOT NULL DEFAULT {}"
        varchar agreement_version
        timestamptz agreement_accepted_at
        varchar slack_username
        varchar github_username
        varchar drive_email
        text notes
        timestamp created_at
    }

    option_lists {
        int id PK
        varchar list_name
        varchar value
        smallint display_order
        boolean active
    }

    participant_options {
        int participant_id FK
        int option_id FK
    }

    cycles ||--|| cycle_config : "configures"
    participants ||--o{ participant_options : "selects"
    option_lists ||--o{ participant_options : "defines"
```

---

## ERD — Enrollment, Roles & Audit

Participants join cycles via `cycle_enrollments`. Elevated permissions are stored in `user_roles`. `access_revocations` is the audit trail for removals. `pulse_checks` tracks weekly engagement.

```mermaid
erDiagram
    participants {
        int id PK
        varchar email UK
    }

    cycles {
        int id PK
        varchar name
    }

    cycle_enrollments {
        int id PK
        int participant_id FK
        int cycle_id FK
        timestamp enrolled_at
        varchar status
        timestamp inactive_date
    }

    user_roles {
        int id PK
        int participant_id FK
        varchar role
        int granted_by FK
        timestamp granted_at
        timestamp revoked_at
    }

    access_revocations {
        int id PK
        int participant_id FK
        int cycle_id FK
        varchar reason
        varchar revocation_scope
        timestamp revoked_at
        text[] revoked_systems
    }

    pulse_checks {
        int id PK
        int cycle_id FK
        int participant_id FK
        date scheduled_date
        timestamp completed_at
        jsonb survey_responses
        timestamp created_at
    }

    participants ||--o{ cycle_enrollments : "joins"
    cycles ||--o{ cycle_enrollments : "contains"
    participants ||--o{ user_roles : "holds"
    participants ||--o{ access_revocations : "subject of"
    cycles ||--o{ access_revocations : "logs"
    participants ||--o{ pulse_checks : "completes"
    cycles ||--o{ pulse_checks : "schedules"
```

---

## ERD — Pod Layer (Phases 2–4)

Problem statements are submitted and voted on. Top statements become pods. Participants self-register into pods. Moderators are assigned per pod per cycle.

```mermaid
erDiagram
    cycles {
        int id PK
        varchar name
    }

    participants {
        int id PK
        varchar email UK
    }

    problem_statements {
        int id PK
        int cycle_id FK
        int participant_id FK
        text statement_text
        timestamp created_at
    }

    votes {
        int id PK
        int cycle_id FK
        int voter_id FK
        int problem_statement_id FK
        smallint vote_count
        timestamp created_at
    }

    pods {
        int id PK
        int cycle_id FK
        int problem_statement_id FK
        varchar name
        varchar status
        varchar slack_channel_id
        varchar github_repo_url
        varchar drive_folder_id
        timestamp created_at
        timestamp updated_at
    }

    pod_memberships {
        int id PK
        int participant_id FK
        int pod_id FK
        timestamp joined_at
        timestamp inactive_at
    }

    moderator_assignments {
        int id PK
        int participant_id FK
        int pod_id FK
        int cycle_id FK
        timestamp assigned_at
        timestamp removed_at
    }

    cycles ||--o{ problem_statements : "contains"
    participants ||--o{ problem_statements : "submits"
    problem_statements ||--o{ votes : "receives"
    participants ||--o{ votes : "casts"
    cycles ||--o{ votes : "scopes"
    problem_statements ||--o{ pods : "seeds"
    cycles ||--o{ pods : "generates"
    pods ||--o{ pod_memberships : "has"
    participants ||--o{ pod_memberships : "registers"
    pods ||--o{ moderator_assignments : "assigned"
    participants ||--o{ moderator_assignments : "moderates"
    cycles ||--o{ moderator_assignments : "scopes"
```

---

## ERD — Project Layer (Phases 5–7)

Mirrors the pod layer one level down. Solution proposals are submitted within pods, voted on, and top proposals become projects. Participants self-register into projects (max 1 active project per cycle).

```mermaid
erDiagram
    cycles {
        int id PK
        varchar name
    }

    participants {
        int id PK
        varchar email UK
    }

    pods {
        int id PK
        varchar name
        varchar status
    }

    solution_proposals {
        int id PK
        int cycle_id FK
        int pod_id FK
        int participant_id FK
        varchar name
        varchar summary
        jsonb proposal_data
        text proposal_text
        timestamp created_at
    }

    project_votes {
        int id PK
        int cycle_id FK
        int pod_id FK
        int voter_id FK
        int solution_proposal_id FK
        smallint vote_count
        timestamp created_at
    }

    projects {
        int id PK
        int cycle_id FK
        int pod_id FK
        int solution_proposal_id FK
        varchar name
        varchar status
        varchar slack_channel_id
        varchar github_repo_url
        varchar drive_folder_id
        timestamp created_at
        timestamp updated_at
    }

    project_memberships {
        int id PK
        int participant_id FK
        int project_id FK
        int cycle_id FK
        timestamp registered_at
        timestamp left_at
    }

    pods ||--o{ solution_proposals : "contains"
    participants ||--o{ solution_proposals : "submits"
    cycles ||--o{ solution_proposals : "scopes"
    solution_proposals ||--o{ project_votes : "receives"
    participants ||--o{ project_votes : "casts"
    pods ||--o{ project_votes : "scopes"
    cycles ||--o{ project_votes : "scopes"
    solution_proposals ||--o{ projects : "seeds"
    pods ||--o{ projects : "generates"
    cycles ||--o{ projects : "generates"
    projects ||--o{ project_memberships : "has"
    participants ||--o{ project_memberships : "registers"
    cycles ||--o{ project_memberships : "enforces constraint"
```

---

## ERD — Invitations

Admins send magic link invitations to prospective participants via a CSV bulk upload flow. Each sent invite is one row. Resends create a new row; the original is left intact.

```mermaid
erDiagram
    invitations {
        int id PK
        varchar email
        uuid token UK
        text[] permissions
        varchar role_preset
        int cycle_id FK
        int pod_id FK
        int invited_by FK
        varchar status
        timestamp created_at
        timestamp accepted_at
        timestamp expires_at
        timestamp email_sent_at
        text notes
    }

    participants ||--o{ invitations : "sends"
    cycles ||--o{ invitations : "scopes (optional)"
    pods ||--o{ invitations : "scopes (optional)"
```

**Status values:** `pending` (sent, not yet accepted) · `accepted` (invitee logged in) · `expired` (link expired) · `revoked` (admin cancelled)

**`email_sent_at`:** Timestamp of the last time the magic link email was sent via Resend. `NULL` means the link was created but only shared via copy-paste, never emailed.

**Bulk invite flow:** `cycle_id`, `pod_id`, `permissions`, and `role_preset` are NULL/empty. `notes` carries per-row messaging back to the admin (e.g. "Name not found in participants", "Already logged in").

---

## Table Summary

| Table | Group | Purpose |
|---|---|---|
| `cycles` | Core | Root entity; a single build cohort |
| `cycle_config` | Core | All tunable thresholds & window timestamps |
| `participants` | Core | System-wide identity & profile |
| `option_lists` | Core | Seed data for multiselect fields |
| `participant_options` | Core | Junction: participant ↔ multiselect choices |
| `cycle_enrollments` | Enrollment | Participant ↔ cycle membership + status |
| `user_roles` | Roles | Elevated roles (owner, admin, observer) |
| `moderator_assignments` | Roles | Pod-scoped moderator grants per cycle |
| `access_revocations` | Audit | Log of revocations with scope & reason |
| `pulse_checks` | Engagement | Weekly check-in responses (flexible JSONB) |
| `problem_statements` | Pod Layer | Submitted problems, one per participant per cycle |
| `votes` | Pod Layer | Budget-based votes on problem statements |
| `pods` | Pod Layer | Shortlisted problems with external integrations |
| `pod_memberships` | Pod Layer | Self-registration into pods (soft delete) |
| `solution_proposals` | Project Layer | Solutions submitted within pods. Rich payload via `name` + `summary` columns + `proposal_data` JSONB. `UNIQUE(cycle_id, participant_id)` enforces one submission per participant per cycle (migration 00016, W2-001). |
| `project_votes` | Project Layer | Budget-based votes on solution proposals |
| `projects` | Project Layer | Shortlisted solutions with external integrations |
| `project_memberships` | Project Layer | Self-registration into projects (1 active/cycle) |
| `invitations` | Invitations | Magic link invites sent by admins; one row per send |
