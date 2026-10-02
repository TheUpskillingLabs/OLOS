# `app/api/` — the route handlers: every mutation, export, and cron

| | |
|---|---|
| **What this is** | The 131 Next.js route handlers (`route.ts`, one per URL, in 38 top-level folders) that the pages, the admin and Poderator surfaces, the public forms, and Vercel Cron call. There is no separate backend service: a handler checks auth, validates the body, and talks to Supabase or a `lib/` module. |
| **Zone / owner** | `backend` (`app/api/**`, `lib/**`). `app/api/admin/pods/` and `app/api/moderator/pods/` belong to the enrollment / moderator / admin **single-owner zone** with `lib/enrollment/` and `lib/moderator/` — one backend teammate at a time ([`docs/agent-teams.md`](../../docs/agent-teams.md)). |
| **Conventions** | No `CLAUDE.md` here. Wrap a handler in `withAuth` / `withAdminAuth` / `withOwnerAuth` from [`lib/auth/middleware.ts`](../../lib/auth/middleware.ts) unless the route is deliberately public (RSVP, story and survey submission, lab suggestions, cron, the OAuth callback); parse bodies with `parseBody` and a `lib/validations/` schema; return database failures through `dbError`, never the raw error; a service-role read is preceded by the same role check the UI gates the button on; the wrapper refuses writes while an admin is "viewing as" a member. |
| **Last verified** | 2026-10-02 |

## What is here

Methods verified from each `route.ts`; the `lib/` column names the domain module the folder
leans on (every route also uses `lib/auth/middleware`, `lib/api/*`, `lib/supabase/*`).
"No in-repo caller" means no page, component, or script references the URL today — treat it
as legacy and verify before relying on it. `…` continues the previous path.

| Route folder | Methods | `lib/` | Notes |
|---|---|---|---|
| **Auth and access** | | | |
| `auth/callback` | GET | `auth/bans`, `auth/invitations`, `participants/placeholder` | The OAuth return: ban gate, invitation fulfilment, `/register` when no participant row. Called by Supabase, not the UI. |
| `access/roles` | POST, DELETE | `auth/grants`, `auth/permissions` | Grant / revoke a global authority role (`/admin/access`). |
| `permissions`, `permissions/preset` | GET, POST / POST | `auth/permissions`, `auth/grants` | Per-person capability toggles and role presets. |
| `invitations`, `…/[invitation_id]`, `…/send` | GET, POST / PATCH / POST | `auth/roles`, `auth/lab`, `email` | Magic-link invites; a lab lead invites only into their own lab and never mints permissions. |
| **Enrollment and registration** | | | |
| `registrations/funnel` | POST | `labs/membership`, `cycle/active`, `auth/bans`, `email` | The signup funnel's write: participant row, zip → lab, agreement record, confirmation email. |
| `labs/suggest`, `labs/waitlist`, `labs/[lab_id]/join`, `…/promote`, `…/leads` (+ `[participant_id]`), `…/contacts/export` | GET / POST / POST / POST / GET, POST, DELETE / GET | `labs/membership`, `lab/contacts`, `export` | Local Lab membership, waitlists, lead roster, lab CSV ([`docs/LOCAL_LABS.md`](../../docs/LOCAL_LABS.md)). `suggest` is public. |
| `metros/[metro_id]/waitlist` | POST | — | The older one-tap waitlist join; `labs/waitlist` is the find-or-create path. |
| `cycles/[cycle_id]/agreement` | GET, POST | `cycles/schedule`, `cycles/lab-time`, `labs/membership` | The Open Cycle Agreement signature that ends the registration ceremony. Never activates an enrollment — the reconciler does. |
| `cycles/[cycle_id]/interest` | POST | `labs/membership` | Writes the `inactive` interest enrollment. No in-repo caller (verify); `agreement` writes the same row. |
| `revocations/[cycle_id]`, `…/check/[cycle_id]`, `…/reactivate/[participant_id]` | GET / POST / POST | `learning-logs/at-risk`, `enrollment/reconciler` | Admin view of `access_revocations`, the manual twin of the revocation cron, reactivation. |
| `testing/reset` | POST | — | A tester's self-reset: deletes the caller's own journey rows (tester-only). |
| **Cycles, pods, projects** | | | |
| `cycles`, `cycles/[cycle_id]`, `…/config`, `…/status`, `…/advance-phase`, `…/pods`, `…/contacts/export` | GET, POST / GET / GET, PATCH / PATCH / POST / GET / GET | `cycle/*`, `cycles/schedule`, `projects/finalize`, `validations/cycles` | Cycle creation and config, the lifecycle (`closeout`), phase fast-forward (`testing:use` permission), the per-lab pod list, cycle CSV. `…/participants` and `…/my-solution-proposal` (GET) have no in-repo caller (verify). |
| `pods/[pod_id]`, `…/register`, `…/moderators` (+ `remove`), `…/solution-proposals`, `…/project-votes`, `…/projects`, `…/projects/finalize`, `…/contacts/export` | GET / POST, DELETE / GET, POST, POST / GET, POST / GET, POST / POST / POST / GET | `auth/windows`, `cycle/guards`, `enrollment/reconciler`, `auth/grants`, `projects/finalize`, `pod/contacts` | Self-registration, Poderator assignment, the solution-proposal ballot (member payload hides authorship), org-cycle project chartering, finalize, pod CSV. `…/members` (GET, PATCH `[participant_id]`) and `…/name` (PATCH) have no in-repo caller (verify). |
| `projects/[project_id]`, `…/register`, `…/contributors` (+ `[participant_id]`), `…/contacts/export` | GET / POST, DELETE / POST, DELETE / GET | `auth/projects`, `auth/windows`, `follows/seed`, `project/contacts` | Project registration, the DRI / contributor ladder ([`docs/ORG_CYCLES.md`](../../docs/ORG_CYCLES.md)), project CSV. `…/name` (PATCH) has no in-repo caller (verify). |
| `dashboard/[cycle_id]` (+ `pods/[pod_id]`) | GET | — | Pre-Learning-Log summaries over `pulse_checks`. No in-repo caller — legacy (verify). |
| **Learning Logs, pulse checks, Leadership Logs, tasks** | | | |
| `learning-logs` | GET, POST | `learning-logs/*`, `cycle/week`, `cycle/milestones`, `enrollment/reconciler` | The weekly ritual and its gate; a shared reflection is the one write path from a log into `profile_updates`. |
| `leadership-logs` | GET, POST | `leadership-logs/scopes` | The org cascade's lead tiers (non-blocking). |
| `pulse-checks`, `…/me`, `…/[cycle_id]`, `…/enforcement` | POST / GET / GET / GET | `validations/pulse-checks` | The pre-July weekly instrument. Only the POST has a caller (`/pulse-check`); the GETs have none. Legacy. |
| `nominations` | GET | — | Pulse-check peer nominations. No in-repo caller (verify). |
| `tasks/dismiss` | POST, DELETE | `tasks/keys` | Dismiss / restore a dashboard task (`task_dismissals`). |
| **Poderator** (`/moderator` URLs; the copy says "Poderator") | | | |
| `moderator/pods`, `…/[pod_id]`, `…/recent-logs`, `…/recent-pulses`, `…/pulse-responses/[participant_id]`, `…/explore/export` | GET each | `moderator/*`, `auth/moderator`, `entity-explorer` | The All-pods and per-pod views. The server-rendered pages call the same `lib/moderator` loaders directly; these serve client refreshes. Single-owner zone. |
| `moderator/nudges/dismiss`, `moderator/ui-state` | POST / GET, PUT | `validations/moderator` | Per-Poderator nudge dismissals and saved UI state. |
| **Admin and owner** | | | |
| `admin/pods/[pod_id]` (+ `memberships`, `memberships/[participant_id]`), `admin/projects/[project_id]/memberships`, `admin/participants/[participant_id]/reconcile` | PATCH / POST / DELETE / POST / POST | `enrollment/reconciler`, `auth/lab`, `validations/admin-*` | Roster overrides and the reconciler trigger. Single-owner zone; audit columns deferred to #115. |
| `admin/workstreams` (+ `[workstream_id]`, `…/runs`) | POST / PATCH / POST | `cycle/org-sector`, `enrollment/reconciler`, `validations/workstreams` | Org workstreams and their runs. |
| `admin/events` (+ `sync`), `admin/resources`, `admin/stories`, `admin/announcements`, `admin/feedback` | PATCH, POST / POST, PATCH, DELETE / PATCH, DELETE / POST, PATCH, DELETE / PATCH | `integrations/luma`, `validations/*-admin`, `auth/lab` | Content administration; lab leads may author announcements for their own lab only. |
| `admin/weekly-messages`, `admin/tasks` (+ `[task_id]`) | GET, PUT / GET, POST, PATCH | `validations/cycles`, `validations/custom-tasks` | "What's next" copy per week; admin-authored member tasks. |
| `admin/access/contacts/export`, `admin/people/contacts/export`, `admin/explore/export` | GET | `admin/people-contacts`, `export/csv`, `entity-explorer` | Master CSV exports (PII); the Entity Explorer export (`ENTITY_EXPLORER_ENABLED`). |
| `admin/staff-flag`, `admin/testers`, `admin/simulate` (+ `exit`) | POST, DELETE / POST, DELETE / POST, DELETE, GET | `auth/simulation`, `env/project` | Core-contributor visibility flag; tester grant; read-only "View as" (owner-only on prod). |
| `owner/[entity]/[id]` | POST, DELETE | `owner/*` | Archive / reset / ban / unban / hard delete, registry-driven (`OWNER_CONSOLE_ENABLED`). |
| **Public content** | | | |
| `events/[event_id]/rsvp` | POST | `integrations/luma`, `api/rate-limit` | Public RSVP, per-IP throttled; members register one-tap. |
| `stories` | POST | `api/rate-limit`, `validations/story-submission` | Public Spotlight submission; lands as `submitted`, published from `/admin/stories`. |
| `surveys`, `surveys/[slug]`, `…/questions` (+ `[question_id]`, `reorder`), `…/responses`, `…/export` | POST / PATCH / GET, POST / PATCH, DELETE / POST / POST / GET | `content/surveys`, `content/survey-results`, `validations/survey-*` | Field surveys ([`docs/SENSEMAKING_FLOW.md`](../../docs/SENSEMAKING_FLOW.md)); `responses` is public and account-free. |
| `og/survey/[slug]` | GET (`route.tsx`) | `og/survey-card` | The survey's social-card image. |
| `pages/[type]/[id]/admins` (+ `[participantId]`), `posts` | POST / DELETE / POST | `pages/authz`, `validations/post` | Explicit page admins; a feed update as yourself or as a page. |
| `options` | GET, POST | — | `option_lists` read (public) and admin add. No in-repo caller (verify). |
| **Social and the ballot** | | | |
| `follows`, `saved` | POST / POST | `follows/data` | Idempotent follow and saved-item toggles. |
| `updates/feed`, `updates/[id]` (+ `like`, `comments`, `comments/[commentId]`) | GET / DELETE / POST, DELETE / POST / DELETE | `updates/feed`, `updates/social`, `pages/authz` | The community feed, likes, comments. |
| `directory/suggest`, `participants/[participant_id]` (+ `avatar`), `feedback` | GET / GET, PATCH / POST, DELETE / POST | `metros`, `validations/participants-update`, `validations/feedback` | Nav typeahead (display-column allowlist), profile edits, avatar upload, in-app feedback. |
| `problem-statements` (+ `[cycle_id]`), `votes` (+ `[cycle_id]`), `voting/finalize/[cycle_id]` | POST / GET / POST, PUT / GET / POST | `auth/windows`, `cycle/guards`, `enrollment/revocation`, `voting/rank`, `llm/names` | Phase 1 submissions, the per-lab budget ballot, and the admin finalize that turns it into pods (idempotent). |

**Cron.** `GET` routes under `cron/`, called by Vercel ([`vercel.json`](../../vercel.json))
with `Authorization: Bearer $CRON_SECRET`. Six routes compare the header to the template
`Bearer ${process.env.CRON_SECRET}`; with the variable unset that is the literal
`Bearer undefined`, so a caller who sends it is let in — the fail-open of #407 (filed as
"the five older crons"; the unscheduled `revocation-check` carries the same check). Only
`learning-log-compliance-nudge` refuses to run without a secret.

| Route | Schedule | If `CRON_SECRET` is unset | Status |
|---|---|---|---|
| `cron/learning-log-window` | `0 21 * * 5` (Fri 21:00 UTC) | fails open (#407) | live — stamps `cycle_config.log_due_at` |
| `cron/learning-log-reminder` | `0 9 * * *` (daily 09:00 UTC) | fails open (#407) | live — one email per window |
| `cron/leadership-log-window` | `0 13 * * 3` (Wed 13:00 UTC) | fails open (#407) | live — arms the org cascade |
| `cron/leadership-log-reminder` | `0 9 * * *` (daily 09:00 UTC) | fails open (#407) | live — Thu / Fri tiers |
| `cron/sync-luma-events` | `0 */6 * * *` (every 6 h) | fails open (#407) | live — no-op without `LUMA_API_KEY` |
| `cron/revocation-check` | not scheduled (#213) | fails open (same check) | dark; manual twin at `revocations/check/[cycle_id]` |
| `cron/learning-log-compliance-nudge` | not scheduled (#362) | fails closed (401) | dark; dry-run unless `LOG_COMPLIANCE_NUDGE_ENABLED=true` |

## How it fits

`proxy.ts` allowlists everything under `/api/`, so each handler is its own gate through
[`lib/auth/`](../../lib/auth/CLAUDE.md): `withAuth` resolves roles and hands the handler an
RLS-bound Supabase client; service-role reads sit behind an explicit role check. Handlers
call the domain modules in [`lib/`](../../lib/README.md) and the tables in
[`SCHEMA.md`](../../SCHEMA.md); server components often call the same `lib/` loaders
directly, which is why some routes exist only for client components. The map is
[`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) ("`app/`", "Scheduled jobs"); the cron
inventory is §4.2 of [`docs/roadmap/2026-09-audit.md`](../../docs/roadmap/2026-09-audit.md);
the Poderator routes follow
[`docs/poderator-dashboard/CLAUDE.md`](../../docs/poderator-dashboard/CLAUDE.md).

## Open issues in this area (snapshot 2026-10-02)

Live view: [label `area/backend`](https://github.com/TheUpskillingLabs/OLOS/issues?q=is%3Aopen+label%3Aarea%2Fbackend) ·
[all open issues](https://github.com/TheUpskillingLabs/OLOS/issues).

- [#407](https://github.com/TheUpskillingLabs/OLOS/issues/407) — Cron auth fails open on the five older crons when `CRON_SECRET` is unset — make them fail closed (`priority/p1, size/s`)
- [#213](https://github.com/TheUpskillingLabs/OLOS/issues/213) — [ops][p1] Schedule the two-stage revocation cron (#110 remnant — route exists, nothing invokes it) (`priority/p1, size/s`)
- [#362](https://github.com/TheUpskillingLabs/OLOS/issues/362) — Enable the Learning Log compliance nudge cron (dry-run → schedule)
- [#416](https://github.com/TheUpskillingLabs/OLOS/issues/416) — A3 — Pre-cycle drip: `scheduled_messages` + admin form + daily cron, consent-gated, `email_log`-idempotent, dry-run by default (`priority/p1, size/l, persona/pre-registrant`)
- [#424](https://github.com/TheUpskillingLabs/OLOS/issues/424) — B5 — Monday Poderator digest email: pod health, the outreach queue, last week's loop numbers (`priority/p2, size/s`)
- [#430](https://github.com/TheUpskillingLabs/OLOS/issues/430) — C5 — Optional Monday admin digest email from the metrics views (`priority/p2, size/s`)
- [#431](https://github.com/TheUpskillingLabs/OLOS/issues/431) — D1 — `email_log` written by every sender + `alreadySentWithin(kind, participant, window)` helper + `lib/email/kinds.ts` (`priority/p1, size/m`)
- [#434](https://github.com/TheUpskillingLabs/OLOS/issues/434) — S2.1 — `activity_events` spine: table, writer helper, ceremonial verbs from the existing write paths, `visibility` RLS (`priority/p1, size/l`)
- [#436](https://github.com/TheUpskillingLabs/OLOS/issues/436) — S2.3 — Slack identity + provisioning (ADR-0003 first slice; #189 Parts C–D, H): identity table, reconcile cron, `#intros` verification, channel provisioning (`priority/p1, size/l`)
- [#460](https://github.com/TheUpskillingLabs/OLOS/issues/460) — A9 — Lane S: `weekly_messages` grows audiences, T-minus weeks, title/why/CTA, and an email channel — the success team's one place to write what to do each week (`priority/p1, size/l`)
- [#105](https://github.com/TheUpskillingLabs/OLOS/issues/105) — [backend+frontend] harden LinkedIn URL handling — validate format + sanitize render (`good first issue, priority/p2, size/s`)
- [#383](https://github.com/TheUpskillingLabs/OLOS/issues/383) — Participant erasure: owner-gated Danger Zone is silently hidden; path undiscoverable and partially defective
- [#384](https://github.com/TheUpskillingLabs/OLOS/issues/384) — Platform bans / blacklist: prevent re-registration after removal (design + policy scoping)
- [#115](https://github.com/TheUpskillingLabs/OLOS/issues/115) — [ops][p2] Admin audit columns on pod_memberships (deferred from #110 Phase B) (`priority/p2, size/s`) — cited in the `admin/pods/` route comments

This list is a snapshot; the live view above is the truth. Refreshed at each sprint
boundary ([`docs/roadmap/documentation-framework.md`](../../docs/roadmap/documentation-framework.md) §9.1).

## Before you change something

- **Tests.** `npm run test` runs Vitest over `lib/**/*.test.ts` only — handlers have no
  tests, so put the logic in `lib/` and test it there. What covers these routes today:
  `lib/validations/*.test.ts`, `lib/api/rate-limit.test.ts`,
  `lib/enrollment/reconciler.test.ts`, `lib/learning-logs/*.test.ts`,
  `lib/moderator/*.test.ts`, `lib/owner/*.test.ts`, `lib/projects/shortlist.test.ts`,
  `lib/voting/rank.test.ts`, `lib/auth/*.test.ts`. CI also runs `check:migrations`, `lint`,
  `tsc --noEmit`, and `build`.
- **Every handler is a gate.** The `lib/auth/middleware` wrapper, a `lib/validations/` schema,
  `dbError`; re-check the role before a service-role read; never return authorship or
  timestamps during blind voting; CSV exports carry PII and stay role-gated.
- **Crons** fail closed and ship dry-run by default (copy
  `cron/learning-log-compliance-nudge`); adding one to `vercel.json` is a separate,
  deliberate step with a `CHANGELOG.md` line.
- **Copy.** "The Labs" (never "TUL"), "Upskiller", "Poderator" (the URL says `moderator`,
  the copy never does); never course / class / student / lesson / module in anything a
  member sees, error strings included. No names of real participants in fixtures or comments.
- **Constitution.** No in-app LLM features (the one existing call is the pod / project name
  seed behind `voting/finalize` and `pods/[pod_id]/projects/finalize`, described in
  [`lib/README.md`](../../lib/README.md)); no activity telemetry; consent-gated messaging;
  nothing that shames a member who is behind.
- Branch off `dev`, one issue per PR, a `CHANGELOG.md` line, `npm run check:docs` when docs
  change — [`CONTRIBUTING.md`](../../CONTRIBUTING.md).
