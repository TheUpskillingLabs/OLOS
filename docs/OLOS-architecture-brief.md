# OLOS — Architecture Brief

> **⚠ PARTLY HISTORICAL (banner added July 2026).** The Stack table below
> still says "Backend: Python/FastAPI" and "magic links via Resend SMTP" —
> both predate the shipped Next.js + Supabase + Resend-HTTP reality. For the
> current architecture read `SCHEMA.md` and `docs/audit/DATA_ARCHITECTURE.md`.

*The 5-minute orientation for every new contributor*

---

## What OLOS is

OLOS is **The Upskilling Labs' build-cycle operating system** — a custom application that replaces a battery of Google Forms and reconciliation spreadsheets with a single tool that walks Upskillers through ideation → pods → projects → showcase across a 13-week build cycle.

It exists to free a small staff from manual coordination work so they can spend their time engaging with the community, not maintaining cross-sheet joins.

---

## The core abstraction: Cycle → Pod → Project

A **Cycle** is a 13-week build cohort with a theme (e.g. "Health Systems," "Energy & Climate"). It's the root entity.

A **Pod** belongs to a cycle and is seeded by a top-voted *problem statement*. Pods exist in `forming` status until they hit a configurable minimum registrant count, then go `active` and get external resources provisioned (Slack channel, Drive folder, GitHub repo, Google Group).

A **Project** belongs to a pod and is seeded by a top-voted *solution proposal*. Same lifecycle as pods: `forming` → `active` on reaching `project_min`, with its own resource provisioning.

Hierarchy is strict: **a project is always inside a pod, which is always inside a cycle.** No project lives outside a pod; no pod outside a cycle.

---

## The phase machine

Every cycle moves through seven phases, each gated by a configurable open/close window in `cycle_config`:

| Phase | What happens | API endpoint |
|---|---|---|
| 1 | Problem statement submission | `POST /api/problem-statements` |
| 2 | Pod-level (stack) voting | `POST /api/votes` |
| 3 | Pod shortlist published; participants self-register | `POST /api/pods/{id}/register` |
| 4 | Solution proposal submission within active pods | `POST /api/pods/{id}/solution-proposals` |
| 5 | Solution voting within pods | `POST /api/pods/{id}/project-votes` |
| 6 | Project shortlist published per pod | `POST /api/pods/{id}/projects/finalize` |
| 7 | Project self-registration | `POST /api/projects/{id}/register` |

**Pulse checks run alongside all phases.** They have no window — they're always open during an active cycle. Missing 2+ consecutive pulse checks is one of the two triggers for inactive status (the other is being in no pod).

---

## Roles

Five roles. Two are explicit grants (Owner/Admin/Observer in `user_roles`), one is implicit from a row in `moderator_assignments`, and Participant is *derived* from `cycle_enrollments.status`.

| Role | Storage | Scope |
|---|---|---|
| Owner / Admin | `user_roles` | Global |
| Moderator | `moderator_assignments` row, `removed_at IS NULL` | Assigned pod(s) for one cycle |
| Participant (active) | `cycle_enrollments.status = 'active'` | Own pod(s) + projects within them |
| Participant (inactive) | `cycle_enrollments.status = 'inactive'` | Read-only |
| Observer | `user_roles` | All cycles, read-only |

Roles **stack**: a Moderator who is also a Participant gets both permission sets unioned.

---

## Five architectural invariants

These are constraints that don't change. Internalize them:

### 1. Phase windows are server-enforced
Every write endpoint validates `now()` against `cycle_config.{phase}_open / _close` and returns `403` outside the window. No admin override exists. `NULL` timestamps mean "not scheduled" and also return `403`. Pulse checks are the lone exception.

### 2. Roles stack; visibility is the union
JWT claims carry the resolved role set at token issuance. Endpoints authorize against claims; moderator pod-scope is *additionally* re-checked at endpoint level for write operations.

### 3. Pod membership is multi; project membership is exclusive
A participant may be in N pods within a cycle (N is configurable via `cycle_config.pod_limit`, default 2 long-term, higher in early cycles). A participant may be in **exactly one** active project per cycle, enforced by a partial unique index on `project_memberships`.

### 4. Resources provision at activation, not formation
A pod or project at `forming` is just a database row. Once registrant count hits `pod_min` / `project_min`, the backend provisions four external resources synchronously: Slack channel, Drive folder, GitHub repo, Google Group. Provisioning failures don't block activation — they're returned as warnings.

### 5. Soft delete everywhere
`pod_memberships.inactive_at`, `project_memberships.left_at`, `moderator_assignments.removed_at`, `user_roles.revoked_at`, `access_revocations` audit log. Rows are never hard-deleted. This makes reactivation possible and gives us an audit trail.

---

## The stack at a glance

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router) |
| Auth | Supabase Auth + Google OAuth + magic links via Resend SMTP |
| Backend | Python / FastAPI |
| DB | PostgreSQL (hosted on Supabase) |
| External | Slack (`slack_sdk`), Google Drive + Groups (`google-api-python-client`), GitHub (`PyGithub`), Resend |
| LLM | Anthropic API (`claude-haiku-4-5-20251001`) for pod/project name generation |

The frontend talks to FastAPI via REST. FastAPI talks to Postgres directly via the Supabase connection string (not the Supabase client lib — performance). All authenticated calls use a FastAPI JWT, not the Supabase session token.

---

## What replaces what

The legacy workflow is `Upskiller_Community_Manager.xlsx` — a 9-sheet workbook with manually maintained cross-sheet joins. OLOS replaces it like this:

| Spreadsheet artifact | OLOS replacement |
|---|---|
| `Upskiller Registrations` sheet | `participants` + `cycle_enrollments` + `participant_options` |
| `Pod Registration` sheets (Seat 1/2/3) | `pod_memberships` (one row per seat) |
| `Problem Statement Submissions` | `problem_statements` + JSONB `context` field |
| `Voting & Pods` (Vote 1/2/3 columns) | `votes` (with `vote_count` column) |
| `Management Dashboard` Action lists ("Ghosts," "Backdoor," "Slack Defaulters") | Derived SQL queries — no storage needed |
| `Pod Registration Summary` (live tally) | `SELECT COUNT(*) ... GROUP BY pod_id` |
| `Flagged Voter` reconciliation column | Eliminated by foreign keys |
| `Mentor Registrations` | New `mentors` table (Wave 2 — pending decision D3) |

The single biggest conceptual shift: pods used to be identified by string label (`"9. Medical Record Consolidation"`) shared across sheets. In OLOS pods have integer IDs and string typos become impossible.

---

## Where things live in the repo

*(To be filled in once the repo structure is finalized.)*

```
/app                  Next.js frontend
  /(public)/register  Public registration form
  /pulse-check        Authenticated pulse-check form
  /cycles/[id]        Cycle dashboard
  /pods/[id]          Pod detail
  /admin              Admin views
/api                  FastAPI backend
  /routers            Endpoint modules per resource
  /db                 Schema, migrations, seed data
  /auth               JWT + Supabase token validation
  /integrations       Slack, Drive, GitHub, Groups clients
/scripts              Operational scripts (migration, magic-link bulk gen)
/docs                 OLOS-architecture-brief.md, OLOS-roadmap.md, etc.
```

---

## Reading order for new contributors

1. This document
2. `OLOS-roadmap.md` — what we're building, in what order
3. `OLOS-issue-template.md` — how issues are written
4. The specific issue you're working on
5. `TUL_MVP_Spec.md` — full spec, reference only (don't read end-to-end)
6. `SCHEMA.md` — database schema reference

If you find yourself reading the full spec linearly, you've gone too deep. Drop back to your issue.
