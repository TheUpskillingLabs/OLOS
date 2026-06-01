# Pod → Project Formation Diagram

**File:** `pod-to-project-formation.mmd`  
**Render:** paste into [mermaid.live](https://mermaid.live) or any Mermaid-aware viewer (GitHub, Notion, VS Code with Mermaid plugin).

---

## Shape Legend

| Shape | Mermaid syntax | Meaning |
|---|---|---|
| Stadium `([…])` | `(["text"])` | Participant screen / action |
| Parallelogram `[/…/]` | `[/"text"/]` | Poderator or Admin action |
| Rectangle `[…]` | `["text"]` | API route |
| Cylinder `[(…)]` | `[("text")]` | DB table write |
| Flag `>…]` | `>["text"]` | Email / notification (Resend) |
| Diamond `{…}` | `{"text"}` | Phase gate / guard / decision |
| Subroutine `[[…]]` | `[["text"]]` | System or LLM action |
| Dashed edge `-.->` | `-.->` | TODO / ambiguous path |

---

## Source-of-truth files per node

### Phase 0 — Registration & Onboarding

| Node | Source file(s) |
|---|---|
| Short-registration form | `app/(dashboard)/cycles/[cycle_id]/join/page.tsx` |
| `POST /api/registrations/short` | `app/api/registrations/short/route.ts` |
| `participants` write | `app/api/registrations/short/route.ts` |
| `cycle_enrollments` upsert | `app/api/registrations/short/route.ts` |
| Email A: Registration Confirmation | `app/api/registrations/short/route.ts:122-141` · `lib/email/registration-confirmation-template.ts` |
| Email B: Already Registered | `app/api/registrations/short/route.ts:44-55` · `lib/email/already-registered-template.ts` |
| Long-form join page | `app/(dashboard)/cycles/[cycle_id]/join/page.tsx:1-96` |
| `POST /api/cycles/[cycle_id]/interest` | **MISSING** — route file not found (TODO-2) |

### Phase 1 — Problem Discovery

| Node | Source file(s) |
|---|---|
| Cycle phase indicator | `app/(dashboard)/cycles/cycle-phase-indicator.tsx:1-382` |
| Propose page | `app/(dashboard)/cycles/[cycle_id]/propose/page.tsx:1-108` |
| `POST /api/problem-statements` | **MISSING** — route file not found (TODO-1) |
| `problem_statements` write | **MISSING** — schema from `supabase/migrations/00006` (TODO-1) |
| Vote page | `app/(dashboard)/cycles/[cycle_id]/vote/page.tsx:1-81` |
| Window: `voting_open/close` | `lib/auth/windows.ts:20-49` · `cycle_config` table |
| Budget guard | `app/api/votes/route.ts:27` · `cycle_config.submitter_votes` / `non_submitter_votes` |
| `POST /api/votes` | `app/api/votes/route.ts:1-88` |
| `votes` write | `app/api/votes/route.ts:73-77` · `supabase/migrations/00006` |
| `GET /api/votes/[cycle_id]` | `app/api/votes/[cycle_id]/route.ts:1-46` |

### Phase 2a — Pod Formation

| Node | Source file(s) |
|---|---|
| Register-pods page | `app/(dashboard)/cycles/[cycle_id]/register-pods/page.tsx:1-120` |
| Dashboard pod-join widget | `app/(dashboard)/dashboard/pod-join-section.tsx:14-169` |
| `GET /api/cycles/[cycle_id]/pods` | `app/api/cycles/[cycle_id]/pods/route.ts:1-53` |
| Window: `pod_registration_open/close` | `lib/auth/windows.ts:20-49` · `cycle_config` table |
| Cap guard (≤2 pods/cycle) | `app/api/pods/[pod_id]/register/route.ts` (inline check) |
| `POST /api/pods/[pod_id]/register` | `app/api/pods/[pod_id]/register/route.ts:1-173` |
| `pod_memberships` insert | `app/api/pods/[pod_id]/register/route.ts:71-74` · `supabase/migrations/00007` |
| Transition: pod `forming` → `active` | `app/api/pods/[pod_id]/register/route.ts:93-116` · `cycle_config.pod_min` |
| `pods.status` → active | `app/api/pods/[pod_id]/register/route.ts:94-97` |
| `cycle_enrollments` batch activate | `app/api/pods/[pod_id]/register/route.ts:99-115` |
| `cycle_enrollments` single activate | `app/api/pods/[pod_id]/register/route.ts:119-126` |
| Resource provisioning at pod activation | **MISSING** — mentioned in architecture brief, no code found (TODO-3) |
| `DELETE /api/pods/[pod_id]/register` | `app/api/pods/[pod_id]/register/route.ts:135-173` |
| `pod_memberships` hard delete | `app/api/pods/[pod_id]/register/route.ts:161-165` |
| `PATCH /api/pods/[pod_id]/name` | `app/api/pods/[pod_id]/name/route.ts:1-36` |
| `pods.name` update | `app/api/pods/[pod_id]/name/route.ts:24-28` |
| Auth guard: `isModeratorForPod` | `lib/auth/roles.ts` (via `UserRoles.moderatorPodIds`) |

### Phase 2b — Solution Proposal

| Node | Source file(s) |
|---|---|
| Solutions page | `app/(dashboard)/cycles/[cycle_id]/solutions/page.tsx:1-185` |
| `GET /api/cycles/[cycle_id]/my-solution-proposal` | `app/api/cycles/[cycle_id]/my-solution-proposal/route.ts:1-31` |
| `GET /api/pods/[pod_id]/solution-proposals` | `app/api/pods/[pod_id]/solution-proposals/route.ts:10-28` |
| Window: `solution_proposal_open/close` | `lib/auth/windows.ts:20-49` · `cycle_config` table |
| Active pod member guard | `app/api/pods/[pod_id]/solution-proposals/route.ts` |
| `solutionProposalSchema` | `lib/validations/pods.ts:19-36` |
| `POST /api/pods/[pod_id]/solution-proposals` | `app/api/pods/[pod_id]/solution-proposals/route.ts:31-116` |
| `solution_proposals` upsert | `app/api/pods/[pod_id]/solution-proposals/route.ts:94-107` · `supabase/migrations/00018` |

### Phase 2c — Solution Vote

| Node | Source file(s) |
|---|---|
| Solution-vote page | `app/(dashboard)/cycles/[cycle_id]/solution-vote/page.tsx:1-144` |
| `GET /api/pods/[pod_id]/project-votes` | `app/api/pods/[pod_id]/project-votes/route.ts:11-50` |
| Window: `solution_voting_open/close` | `lib/auth/windows.ts:20-49` · `cycle_config` table |
| Submitter-only guard | `app/api/pods/[pod_id]/project-votes/route.ts` |
| Idempotency guard (no re-vote) | `app/api/pods/[pod_id]/project-votes/route.ts` · unique constraint `(voter_id, solution_proposal_id, pod_id)` |
| `projectBallotSchema` | `lib/validations/pods.ts:44-53` |
| `POST /api/pods/[pod_id]/project-votes` | `app/api/pods/[pod_id]/project-votes/route.ts:68-210` |
| `project_votes` insert | `app/api/pods/[pod_id]/project-votes/route.ts:196-199` · `supabase/migrations/00015` |

### Phase 2d — Project Finalization

| Node | Source file(s) |
|---|---|
| Poderator finalize trigger | **MISSING** — dashboard UI component not traced (TODO-4) |
| `POST /api/pods/[pod_id]/projects/finalize` | `app/api/pods/[pod_id]/projects/finalize/route.ts:1-143` |
| Guard: `isModeratorForPod OR isAdmin` | `app/api/pods/[pod_id]/projects/finalize/route.ts` · `lib/auth/roles.ts` |
| Vote tally + threshold read | `app/api/pods/[pod_id]/projects/finalize/route.ts` · `cycle_config.project_vote_threshold` |
| LLM name generation | `lib/llm/names` · `app/api/pods/[pod_id]/projects/finalize/route.ts:108-117` (provider TBD — TODO-6) |
| `projects` insert (status=`forming`) | `app/api/pods/[pod_id]/projects/finalize/route.ts:108-117` |
| `PATCH /api/projects/[project_id]/name` | `app/api/projects/[project_id]/name/route.ts:1-47` |
| `projects.name` update | `app/api/projects/[project_id]/name/route.ts:34-38` |

### Phase 3 — Project Registration

| Node | Source file(s) |
|---|---|
| Register-projects page | `app/(dashboard)/cycles/[cycle_id]/register-projects/page.tsx:1-173` |
| Window: `project_registration_open/close` | `lib/auth/windows.ts:20-49` · `cycle_config` table |
| Cap guard (1 project/cycle) | `app/api/projects/[project_id]/register/route.ts` · partial unique index on `project_memberships` |
| `POST /api/projects/[project_id]/register` | `app/api/projects/[project_id]/register/route.ts:1-119` |
| `project_memberships` insert | `app/api/projects/[project_id]/register/route.ts:91-98` |
| Transition: project `forming` → `active` | `app/api/projects/[project_id]/register/route.ts:107-111` · `cycle_config.project_min` |
| `projects.status` → active | `app/api/projects/[project_id]/register/route.ts:108-111` |
| Resource provisioning at project activation | **MISSING** — architecture brief only (TODO-3) |
| `DELETE /api/projects/[project_id]/register` | `app/api/projects/[project_id]/register/route.ts:121-160` |
| `project_memberships.left_at` soft-delete | `app/api/projects/[project_id]/register/route.ts:147-152` |

### Cross-cutting — Cron / Pulse

| Node | Source file(s) |
|---|---|
| Cron: pulse-check-reminder | `app/api/cron/pulse-check-reminder/route.ts:31-151` |
| Pulse reminder emails (3 variants) | `app/api/cron/pulse-check-reminder/route.ts` · `lib/email/pulse-reminder-template.ts` |

---

## Key DB tables (schema migrations)

| Table | Migration file |
|---|---|
| `cycles`, `cycle_config`, `pods`, `pod_memberships`, `participants`, `cycle_enrollments`, `votes`, `problem_statements` | `supabase/migrations/00006` |
| `project_memberships`, `projects` | `supabase/migrations/00007` |
| `project_votes` (preference_rank) | `supabase/migrations/00015` |
| `nominations` | `supabase/migrations/00017` |
| `solution_proposals` rich fields | `supabase/migrations/00018` |

---

## Open questions / TODOs

| ID | Question |
|---|---|
| TODO-1 | `POST /api/problem-statements` route not found — confirm path and that it writes `problem_statements` |
| TODO-2 | `POST /api/cycles/[cycle_id]/interest` (long-form cycle join) route not traced — confirm it exists and what it writes |
| TODO-3 | Slack / Drive / GitHub / Google Group provisioning at pod and project activation — no code found. Background job? Webhook? Admin-manual? |
| TODO-4 | Poderator "finalize projects" button — dashboard UI component not traced. Which page/component calls `POST /api/pods/[pod_id]/projects/finalize`? |
| TODO-5 | Pulse check submission route (`POST /api/pulse-checks`) and `last_pulse_completed_at` update — referenced by cron but not traced |
| TODO-6 | LLM name generation provider in `lib/llm/names` — Anthropic SDK, OpenAI, or other? Confirm fallback behavior on failure |
| TODO-7 | Race condition on `project_votes` idempotency — no explicit DB transaction; relies on `(voter_id, solution_proposal_id, pod_id)` unique constraint as backstop. Intentional? |
| TODO-8 | `participant_options` table — referenced in join page but write route not confirmed |
