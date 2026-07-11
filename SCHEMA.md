# OLOS Database Schema

Single PostgreSQL database. **26 tables owned by this repo's migration chain**
(`supabase/migrations/`, through `00039`), organized around a
**Cycle → Pod → Project** hierarchy.

> **Scope note:** the live dev database carries additional tables and
> `participants` columns provisioned *outside* this repo's chain (e.g.
> `metros`, `lab_leads`, `events`, `spotlights`, profile/social columns).
> This document covers only what the repo's migrations own; treat anything
> else you meet in the DB as externally managed.

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

> **Per-lab formation (migrations `00038`/`00039`):** in an **HQ-open** cycle
> (`cycles.metro_slug IS NULL`, not `is_hq_internal`) this whole pipeline runs
> **once per Local Lab**: participants see and vote on only their own lab's
> problem statements, and finalization forms pods per lab, stamping
> `pods.metro_slug` (projects inherit it from their pod). A cycle with
> `metro_slug` set is a single lab's own cycle; `is_hq_internal = true` marks
> an HQ org-structure cycle (standing teams as "pods") hidden from labs leads.
> Enforcement lives in `lib/auth/cycle-access.ts`.

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
        text description
        text what_you_build
        varchar metro_slug "NULL=HQ; set=a lab's own cycle"
        boolean is_hq_internal "NOT NULL DEFAULT false; HQ org/structure cycle"
    }

    cycle_config {
        int id PK
        int cycle_id FK
        smallint submitter_votes
        smallint non_submitter_votes
        smallint vote_threshold
        smallint max_pods
        smallint pod_min
        smallint pod_limit
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
        timestamp registration_open
        timestamp registration_close
        timestamp phase_2_start
        timestamp phase_3_start
        smallint pulse_band_warning_min
        smallint pulse_band_critical_min
        smallint at_risk_consecutive_misses
        smallint pulse_agg_default_weeks
        text ai_summary_prompt
        timestamptz log_due_at
        boolean log_gate_paused
        smallint milestone_mid_week
        smallint milestone_final_week
        timestamptz leadership_log_due_at
        boolean leadership_log_gate_paused
        timestamp updated_at
    }

    participants {
        int id PK
        uuid auth_user_id "links to auth.users"
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
        varchar metro_slug "the participant's Local Lab; scopes labs_lead"
        text_array role_intents "NOT NULL DEFAULT {}"
        varchar agreement_version
        timestamptz agreement_accepted_at
        varchar ai_experience_level
        text availability_snippet
        varchar profile_image_url
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

Participants join cycles via `cycle_enrollments`. **Authorization's source of
truth is `participant_permissions`** — granular grants (`pods:write`,
`cycles:write`, …) that `can()` checks on every request; role presets
(`owner`, `admin`, `developer`, `labs_lead`, `observer`) expand into these
rows at invite time. `user_roles` is the **audit/identity row** for elevated
roles, not the permission store. `access_revocations` is the audit trail for
removals. `pulse_checks` tracks weekly engagement; `nominations` captures the
people participants nominate from inside a pulse check (third-party PII:
name, email, LinkedIn).

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

    cycle_agreements {
        int id PK
        int participant_id FK
        int cycle_id FK
        varchar agreement_version
        text signature_name
        timestamptz signed_at
        jsonb answers
    }

    participant_permissions {
        int id PK
        int participant_id FK
        varchar permission "e.g. pods:write, cycles:write"
        int granted_by FK
        timestamp granted_at
        timestamp revoked_at
    }

    user_roles {
        int id PK
        int participant_id FK
        varchar role "owner|admin|observer|developer|labs_lead"
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

    nominations {
        int id PK
        int participant_id FK
        int pulse_check_id FK
        int cycle_id FK
        varchar nominee_name
        varchar nominee_email
        varchar nominee_linkedin
        varchar nomination_type "upskiller|mentor|advisor"
        text reason
        timestamp created_at
    }

    participants ||--o{ cycle_enrollments : "joins"
    participants ||--o{ participant_permissions : "granted"
    participants ||--o{ nominations : "nominates via"
    pulse_checks ||--o{ nominations : "collects"
    cycles ||--o{ cycle_enrollments : "contains"
    participants ||--o{ cycle_agreements : "signs"
    cycles ||--o{ cycle_agreements : "binds"
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
        varchar metro_slug "lab; NULL=HQ/legacy"
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
        varchar metro_slug "lab; inherited from pod"
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
| `cycle_agreements` | Enrollment | Open Cycle Agreement signatures (typed name + answers) |
| `participant_permissions` | Roles | **Authorization source of truth** — granular grants checked by `can()` |
| `user_roles` | Roles | Audit/identity rows for elevated roles (owner, admin, observer, developer, labs_lead) — not the permission store |
| `moderator_assignments` | Roles | Pod-scoped moderator grants per cycle |
| `access_revocations` | Audit | Log of revocations with scope & reason |
| `pulse_checks` | Engagement | Weekly check-in responses (flexible JSONB) |
| `nominations` | Engagement | Third-party nominees captured from pulse checks (name, email, LinkedIn, type, reason) |
| `problem_statements` | Pod Layer | Submitted problems, one per participant per cycle |
| `votes` | Pod Layer | Budget-based votes on problem statements (lab-partitioned in HQ-open cycles) |
| `pods` | Pod Layer | Shortlisted problems with external integrations; `metro_slug` = the owning Local Lab (NULL = HQ/legacy) |
| `pod_memberships` | Pod Layer | Self-registration into pods (soft delete) |
| `solution_proposals` | Project Layer | Solutions submitted within pods. Rich payload via `name` + `summary` columns + `proposal_data` JSONB. `UNIQUE(cycle_id, participant_id)` enforces one submission per participant per cycle (migration 00016, W2-001). |
| `project_votes` | Project Layer | Budget-based votes on solution proposals |
| `projects` | Project Layer | Shortlisted solutions with external integrations; `metro_slug` inherited from the pod |
| `project_memberships` | Project Layer | Self-registration into projects (1 active/cycle) |
| `invitations` | Invitations | Magic link invites sent by admins; one row per send |
| `moderator_ui_state` | Moderator | Per-moderator dashboard UI state (poderator dashboard) |
| `nudge_dismissals` | Moderator | Dismissed at-risk nudges on the poderator dashboard |
| `feedback` | Feedback | In-app feedback widget submissions |
| `feedback_attachments` | Feedback | Image attachments on feedback submissions |
