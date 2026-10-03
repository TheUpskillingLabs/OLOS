# `lib/` — server and shared logic, grouped by domain

| | |
|---|---|
| **What this is** | The TypeScript modules (35 folders plus four loose files) that route handlers, server components, crons, and scripts import as `@/lib/…`: auth and guards, the domain rules (cycles, enrollment, logs, tasks), data loaders, CSV exports, email, and the Zod schemas. Pure logic sits next to its `*.test.ts`. |
| **Zone / owner** | `backend` (`lib/**`, `app/api/**`). `lib/enrollment/` and `lib/moderator/` are the **single-owner zone** together with `app/api/admin/pods/` and `app/api/moderator/pods/` — one backend teammate at a time ([`docs/agent-teams.md`](../docs/agent-teams.md)). |
| **Conventions** | `lib/auth/` has agent conventions: [`auth/CLAUDE.md`](auth/CLAUDE.md). Elsewhere: keep a rule pure (no Supabase import) so it gets a `*.test.ts`; a module that imports `supabase/server` is server-only, so client components get a sibling (`metros-label.ts` exists for exactly that); a service-role read sits behind an explicit role check and selects display columns only. |
| **Last verified** | 2026-10-02 |

## What is here

One line per folder — what it owns and its main exports, verified from the code. The four
look-alike pairs are not duplicates: `cycle/` resolves "which cycle, what week, which phase"
while `cycles/` owns the schedule, the window registry, lab-local time, and cycle copy (no
rule separates them — follow the nearest neighbour); `lab/`, `pod/`, and `project/` each hold
only a CSV contact loader, while `labs/` is the membership spine and `projects/` the
finalize / shortlist / gallery rules. There is no `lib/pods/`.

| Path | What it owns (main exports) | Notes |
|---|---|---|
| **Plumbing** | | |
| `api/` | Handler helpers: `dbError` (sanitized 500), `parseIntParam`, `parseBody` + `isErrorResponse` (Zod), `hashIp` / `windowStart` (per-IP throttle for public writes) | |
| `supabase/` | Client factories: `createClient` (browser; server, RLS-bound), `createServiceClient` (service role), `one` (embed unwrapping) | |
| `env/` | `isProdProject` / `projectRef` — which Supabase project this deployment points at (admin banner, simulation guard) | |
| `validations/` | Every Zod schema shared by routes and forms (35 files, one per endpoint family) | tests: `*.test.ts` beside five of them |
| `format/`, `ui/`, `og/` | Hydration-safe `formatDate`, `relTime`; keyboard `nextTabValue` for Tabs; `renderSurveyOgCard` | |
| `donate.ts`, `metros.ts`, `metros-label.ts`, `zip-state.ts` | The every.org `DONATE_URL`; `metroFromZip` (zip → Local Lab from `metros.zip_prefixes`, server-only); `metroLabel` (client-safe); `stateFromZip` (MD / DC / VA / Other) | |
| **Auth and access** | | |
| `auth/` | `withAuth` / `withAdminAuth` / `withOwnerAuth`, `resolveUserRoles` + `isAdmin` / `isOwner` / `isModerator…`, grants and presets, lab-lead scoping, `checkWindow`, bans, invitation fulfilment, the read-only "View as" simulation | [`auth/CLAUDE.md`](auth/CLAUDE.md) first |
| **Enrollment and registration** | | |
| `enrollment/` | `reconcileEnrollmentActivation`, `ensureActivePodMembership`, `reconcilePodMembers` — the one write path for `registered` ↔ `active`; `isCurrentlyRevoked` | single-owner zone |
| `labs/` | The Local Lab membership spine: `requireActiveLabMembership`, `findOrCreateWaitlistLab`, `setActiveLabMembership` | [`docs/LOCAL_LABS.md`](../docs/LOCAL_LABS.md) |
| `lab/`, `pod/`, `project/` | `getLabContacts`, `getPodContacts`, `getProjectContacts` — per-scope CSV loaders on `export/contacts` | PII; the routes are role-gated |
| `participants/` | Handle rules (`slugifyHandle`), the placeholder-name gate (`requireCompleteProfile`), `getParticipantMemberships` (the left rail) | |
| **Cycles, pods, projects** | | |
| `cycle/` | `getOperatingCycle` / `getRecruitingCycle` / `getOrgCycle`, `getCycleWeek`, `getCyclePhase`, milestones, `rejectOrgCycle`, `closeOutCycle`, `podNoun` / `moderatorNoun`, the HQ sector, cycle CSV | [`docs/SECTOR_MODEL.md`](../docs/SECTOR_MODEL.md) |
| `cycles/` | `syncPhasesFromConfig` + `registrationWindow`, the `CYCLE_WINDOWS` registry, lab-local time (`parseWindow`, `fromLabInput`), `HOURS_BUCKETS`, anchor events, info-page copy, `CYCLE_PUBLIC` (a hardcoded constant, interim) | [`docs/requirements/cycle-timeline.md`](../docs/requirements/cycle-timeline.md) |
| `projects/`, `voting/` | `finalizeProjectsForPod` (proposal ballot → projects), the pure `shortlist` tally, `resolveGalleryView`; `rankAndSelect` (problem-statement ballot → pods) | |
| `llm/` | `generateName` + `nameFallback` — the only LLM call in the app; see below | |
| **Learning Logs, Leadership Logs, tasks** | | |
| `learning-logs/` | The weekly gate (`learningLogGate`, pure `resolveGate`), `eligibleLogCycles`, the Week-0 baseline instrument, compliance (`getMemberLogCompliance`), `consecutiveMissedLogWeeks` | |
| `leadership-logs/` | `resolveLeadershipScopes` / `leadershipScopesFor` (which tiers a lead holds), the tier-below context | [`docs/ORG_CYCLES.md`](../docs/ORG_CYCLES.md) |
| `tasks/` | `assembleTasks` — the one place that knows a member's dashboard tasks; `TASK_COPY`; occurrence keys; dismissals; admin preview | UI side: [`app/components/tasks/CLAUDE.md`](../app/components/tasks/CLAUDE.md) |
| **Poderator** | | |
| `moderator/` | `getPodsForUser`, `getPodDetail` (with `synthesizeLogCadence`), `getRollup`, log and pulse health bands, nudges, recent logs / pulses, member pulse history, pod and cross-pod insights, workshops, range filter, UI state; `buildLogInsightsBundle` renders a pseudonymized paste bundle — no LLM call | single-owner zone; [`docs/poderator-dashboard/CLAUDE.md`](../docs/poderator-dashboard/CLAUDE.md) |
| **Admin and owner** | | |
| `admin/`, `export/` | Master contact lists; the shared CSV core (`toCsv`, `buildContactsTable`, `PARTICIPANT_CONTACT_SELECT`) every export reuses | PII |
| `owner/` | The owner console: registry allowlist, `archiveParticipant` / `archiveCycle` / `archivePod`, `banParticipant`, guards, `OWNER_CONSOLE_ENABLED` | off by default |
| `entity-explorer/` | Read-only admin / Poderator data grid: hand-written `REGISTRY`, `fetchEntityList`, `buildExplorerCsv`, `ENTITY_EXPLORER_ENABLED` | off by default |
| `integrations/` | `luma.ts` only: `fetchLumaEvents`, `syncLumaEvents`, `addLumaGuest` | nothing for Slack / Drive / GitHub lives here |
| `email/` | `getResendClient`, `FROM_EMAIL`, seven templates (invitation, registration confirmation, already registered, log reminder, compliance nudge, revocation warning, leadership reminder) | |
| **Public content** | | |
| `content/` | `getEvents` / `getResources` / `getMetros`, Spotlights, field surveys and results, featured events, `.ics`, markdown rendering, sector / workstream pages, saved items | |
| `announcements/`, `pages/` | `fetchAnnouncements`; page authorization (`isPageAdmin`, `pagesUserCanPostAs`) and `resolvePageContext` | |
| **Social** | | |
| `follows/`, `updates/`, `directory/` | Follow graph, auto-seeded page follows, `getPeopleYouMayKnow`; `fetchFeedPage`, likes and comments; `fetchDirectoryData` + `rankByQuery` | |

**`lib/llm/` — exactly what it does.** `names.ts` is two functions. `generateName(type,
description)` makes one call to the Anthropic Messages API through `@anthropic-ai/sdk`
(`ANTHROPIC_API_KEY`) asking for a title-case name of at most three words and 40
characters; `nameFallback(text)` truncates to 40 characters at a word boundary. It has two
importers, both admin- or Poderator-triggered formation steps:
`app/api/voting/finalize/[cycle_id]` names each new pod from its winning problem statement,
and `projects/finalize.ts` names each new project from its winning solution proposal (the
per-pod finalize button and the admin phase advance). Both catch any failure and use
`nameFallback`, so the app runs without a key. No member-facing surface calls it; the only
text that leaves the app is the winning statement or proposal, which is member-written.
[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) calls this "the one ratified in-app LLM
use"; the "no in-app LLM" rule in
[the hand-off brief](../docs/roadmap/handoff-2026-09-28-onboarding-journeys.md) (§4, §8) is
the standard to hold it to.

## How it fits

Route handlers ([`app/api/README.md`](../app/api/README.md)), server components, the crons,
and `scripts/` import from here; `lib/` imports nothing from `app/`. Loaders read the tables
in [`SCHEMA.md`](../SCHEMA.md) through `supabase/`; the rules they encode are described in
[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) ("`lib/`" and "Core domain concepts"),
[`docs/SECTOR_MODEL.md`](../docs/SECTOR_MODEL.md),
[`docs/LOCAL_LABS.md`](../docs/LOCAL_LABS.md), [`docs/ORG_CYCLES.md`](../docs/ORG_CYCLES.md),
and the Poderator PRD [`docs/PRD-moderator-dashboard.md`](../docs/PRD-moderator-dashboard.md).

## Open issues in this area (snapshot 2026-10-02)

Live view: [label `area/backend`](https://github.com/TheUpskillingLabs/OLOS/issues?q=is%3Aopen+label%3Aarea%2Fbackend) ·
[all open issues](https://github.com/TheUpskillingLabs/OLOS/issues).

- [#212](https://github.com/TheUpskillingLabs/OLOS/issues/212) — [labs][p1] Registration routing is metro-blind — getRegistrationCycle() ignores the participant's lab (`priority/p1, size/s`)
- [#463](https://github.com/TheUpskillingLabs/OLOS/issues/463) — B9 — `synthesizeLogCadence` has no join-date floor: a member who joins a pod in week 6 reads as at-risk immediately (`priority/p1, size/s`)
- [#462](https://github.com/TheUpskillingLabs/OLOS/issues/462) — B8 — The All-pods view and rollup read `pulse_checks` only, so every log-era pod shows 0 missing / healthy / At risk 0 (`priority/p1, size/s`)
- [#433](https://github.com/TheUpskillingLabs/OLOS/issues/433) — D3 — Prune the dead enrollment vocabulary (`interested`, `completed`); keep `stepped_back` reserved with a comment (`priority/p2, size/s`)
- [#408](https://github.com/TheUpskillingLabs/OLOS/issues/408) — State-machine reference (`docs/reference/state-machines.md`) + a test that the CHECK vocabularies equal the TypeScript unions (`priority/p1, size/s`)
- [#457](https://github.com/TheUpskillingLabs/OLOS/issues/457) — K8 — Wire the readiness-ladder copy into `lib/tasks/definitions.ts` (with A2 #413): titles, why, time, done-state, links per step (`priority/p1, size/s`)
- [#412](https://github.com/TheUpskillingLabs/OLOS/issues/412) — A1 — Between-cycles dashboard mode: the two lists ("Still open this cycle" / "Get ready for {next cycle}") (`priority/p1, size/l, persona/pre-registrant`)
- [#413](https://github.com/TheUpskillingLabs/OLOS/issues/413) — A2 — Readiness ladder: nine steps, verified where the platform can and manual ticks where it cannot (`priority/p1, size/m, persona/pre-registrant`)
- [#422](https://github.com/TheUpskillingLabs/OLOS/issues/422) — B3 — The loop: "contacted last week → filed a log within 7 days" on the Poderator Insights page (`priority/p1, size/s`)
- [#421](https://github.com/TheUpskillingLabs/OLOS/issues/421) — B2 — `outreach_log`: record that a Poderator reached out (channel, note), visible to that pod's Poderators and admins only (`priority/p1, size/m`)
- [#125](https://github.com/TheUpskillingLabs/OLOS/issues/125) — [refactor][p3] Move 'reactivated' rows out of access_revocations (semantic cleanup) (`priority/p2, size/s`)
- [#115](https://github.com/TheUpskillingLabs/OLOS/issues/115) — [ops][p2] Admin audit columns on pod_memberships (deferred from #110 Phase B) (`priority/p2, size/s`)
- [#431](https://github.com/TheUpskillingLabs/OLOS/issues/431) — D1 — `email_log` written by every sender + `alreadySentWithin(kind, participant, window)` helper + `lib/email/kinds.ts` (`priority/p1, size/m`)
- [#434](https://github.com/TheUpskillingLabs/OLOS/issues/434) — S2.1 — `activity_events` spine: table, writer helper, ceremonial verbs from the existing write paths, `visibility` RLS (`priority/p1, size/l`)
- [#440](https://github.com/TheUpskillingLabs/OLOS/issues/440) — S2.7 — Data catalog (PII class, writers, erasure, retention per table) + the erasure FK-walk test (closes the #383 gap class) (`priority/p1, size/m`)
- [#416](https://github.com/TheUpskillingLabs/OLOS/issues/416) — A3 — Pre-cycle drip: `scheduled_messages` + admin form + daily cron, consent-gated, `email_log`-idempotent, dry-run by default (`priority/p1, size/l, persona/pre-registrant`)
- [#460](https://github.com/TheUpskillingLabs/OLOS/issues/460) — A9 — Lane S: `weekly_messages` grows audiences, T-minus weeks, title/why/CTA, and an email channel — the success team's one place to write what to do each week (`priority/p1, size/l`)
- [#461](https://github.com/TheUpskillingLabs/OLOS/issues/461) — B7 — Lane P: the Poderator's weekly goal — a self-set reach target, "Reached" records in `outreach_log`, the loop line, and the safe "This week's logs query" bundle (`priority/p1, size/m`)
- [#469](https://github.com/TheUpskillingLabs/OLOS/issues/469) — CV2 — Builder track: the `builder_join` window, `cycle_enrollments.tier` stamped at agreement, a ceremony that names only the events still ahead, the register-card copy, and the pod's "ready for builders" chip (`priority/p1, size/m`)
- [#378](https://github.com/TheUpskillingLabs/OLOS/issues/378) — Pods→Projects transition: poderator scoping, project-level log views, and switcher rethink
- [#189](https://github.com/TheUpskillingLabs/OLOS/issues/189) — Slack integration: reminders, in-Slack Learning Log, membership + intro verification — cited in `tasks/assemble.ts` and `tasks/types.ts` (the Slack row has no server-side done signal)

This list is a snapshot; the live view above is the truth. Refreshed at each sprint
boundary ([`docs/roadmap/documentation-framework.md`](../docs/roadmap/documentation-framework.md) §9.1).

## Before you change something

- **Tests** (`npm run test`, Vitest over `lib/**/*.test.{ts,tsx}`; CI also runs
  `check:migrations`, `lint`, `tsc --noEmit`, `build`). By domain — auth:
  `auth/{grants,lab,projects,roles,simulation}.test.ts`; enrollment: `enrollment/reconciler`,
  `labs/membership`, `participants/{handle,memberships,placeholder}`; cycles:
  `cycle/{active,closeout,contacts,guards,labels,org-sector,phase,week}`,
  `cycles/{lab-time,schedule,windows}`, `projects/{gallery-visibility,shortlist}`,
  `voting/rank`, `llm/names`; logs and tasks:
  `learning-logs/{at-risk,baseline-logic,compliance-logic,gate-logic}`,
  `leadership-logs/tier-logic`, `tasks/{assemble,keys,urgency}`; Poderator:
  `moderator/{log-insights,nudges,pods-list}`; admin and owner: `admin/people-contacts`,
  `export/csv`, `owner/{archive,ban,guards,registry}`, `{lab,pod,project}/contacts`; content
  and social: `content/{event-ics,featured,format,markdown,survey-results}`,
  `announcements/data`, `pages/authz`, `follows/suggestions`, `updates/{feed,social}`,
  `directory/rank`; plumbing: `api/rate-limit`,
  `validations/{admin-pod-membership,event-admin,learning-logs,survey-response,votes}`,
  `format/date`, `ui/tabs-keys`, `email/learning-log-reminder-template`, `metros-label`,
  `zip-state`. A new pure helper ships with its own `*.test.ts`.
- **Schema.** A change that needs a migration: claim the number on the issue first, update
  `SCHEMA.md` in the same PR, and keep the CHECK vocabularies equal to the TypeScript unions
  (#408) — the reconciler and the status unions in `enrollment/` are the sharp edge.
- **Cycle facts are data** (2026-10-03, [`../docs/requirements/cycle-4-readiness.md`](../docs/requirements/cycle-4-readiness.md) §2).
  A cycle's dates, length, audience, events, theme and descriptive copy are read from its rows
  (`cycles`, `cycle_config`, `cycle_phases`, `cycle_events`) through one helper per question,
  and written through admin API routes with zod validation. Never a constant that names a cycle,
  a season, or a length ("12 weeks", a literal 13). Lifecycle (`status`) and who may see and join
  a cycle are separate questions (#478). Any function that turns a date into a week, phase, window
  or status is tested against a 91-day and a 56-day cycle (#479). The 12-week template stays the
  default and is not deleted.
- **Copy** in anything that reaches a member (task copy, email templates, labels): "The Labs"
  (never "TUL"), "Upskiller", "Poderator" (code says `moderator`, copy never does); never
  course / class / student / lesson / module. No names of real participants in fixtures.
- **Constitution.** No in-app LLM features beyond the name seed above (and no new importers of
  `llm/`); no activity telemetry; consent-gated messaging; nothing that shames a member who is
  behind — `moderator/` and `learning-logs/` copy is where that is easiest to get wrong.
- Branch off `dev`, one issue per PR, a `CHANGELOG.md` line, `npm run check:docs` when docs
  change — [`CONTRIBUTING.md`](../CONTRIBUTING.md).
