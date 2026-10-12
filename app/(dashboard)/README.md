# `app/(dashboard)/` — the signed-in app

| | |
|---|---|
| **What this is** | Every page a signed-in member, Poderator, admin, or lab lead sees: the home dashboard, the cycle pages, pods and projects, the social layer, and the three persona surfaces (`/moderator`, `/admin`, `/lab`). The parentheses are a Next.js route group — they never appear in a URL. |
| **Zone / owner** | `frontend` ([`docs/agent-teams.md`](../../docs/agent-teams.md), file-ownership map). The `moderator/` and `admin/` pages sit on top of the **single-owner** backend zone (`lib/enrollment/`, `lib/moderator/`, `app/api/admin/pods/`, `app/api/moderator/pods/`) — one owner at a time there. |
| **Conventions** | No `CLAUDE.md` in this folder. Read [`docs/poderator-dashboard/CLAUDE.md`](../../docs/poderator-dashboard/CLAUDE.md) before touching `moderator/`, [`lib/auth/CLAUDE.md`](../../lib/auth/CLAUDE.md) before any guard or role check, and [`app/components/tasks/CLAUDE.md`](../components/tasks/CLAUDE.md) before any task-shaped UI. |
| **Last verified** | 2026-10-02 |

## What is here

Pages are React Server Components; each row names the `lib/` modules the page imports (read on
2026-10-02). Client pieces (`*-form.tsx`, panels) sit beside their page and call `app/api/`.

| Path | What it renders, and the `lib/` it reads | Notes |
|---|---|---|
| **The shell** | | |
| `layout.tsx` | Resolves the viewer (`lib/auth/simulation` → `effectiveUser`), runs the placeholder-name gate (→ `/profile/edit?required=true`) and the weekly Learning Log gate (`lib/learning-logs/gate`; a locked member is bounced to `/dashboard`), resolves roles (`lib/auth/roles`), and renders `AppNav`, the "Join a Local Lab" band, `DashboardFooter`, `FeedbackWidget`, `SimulationBanner`. | Sign-in itself is [`proxy.ts`](../../proxy.ts) + `app/(auth)/`. |
| `loading.tsx`, `error.tsx`, `not-found.tsx` | The group's spinner, the "Something went wrong" card, and the in-shell 404 for a cycle / pod / project / member that moved. | |
| `page-updates-section.tsx` (+ `page-update-composer.tsx`, `page-admins-manager.tsx`) | A page's "Updates" block — follower count, the post-as-page composer and page-admin roster (admins only), then the page's feed. Dropped into pod, project, lab, sector, and workstream pages. Reads `lib/pages/authz`, `lib/pages/server`. | Posts via `/api/posts`, `/api/pages/*/admins`. |
| `people-you-may-know.tsx` | Follow suggestions seeded from podmates / labmates / cyclemates (`lib/follows/suggestions`). On the dashboard rail and the directory. | Renders nothing when there is no one to suggest. |
| **Every member** | | |
| `dashboard/` | `/dashboard`, the home: hero, the "Up next" queue (`TaskList` ← `lib/tasks/tasks`), the "Get set up" checklist, the register card, the feed composer with its Learning Log tab (`lib/learning-logs/*`), the leadership log card (`lib/leadership-logs/*`), commitments + phase rail (`lib/cycle/*`), memberships (`lib/participants/memberships`), announcements, quick links, the following feed. | Lane M (#412 / #413) adds the between-cycles mode here. |
| `cycles/` | `/cycles` (the list, with the phase rail and "Open now" rows) and `/cycles/[id]`, plus the formation-phase pages: `join` (the registration ceremony on `FlowScreen`), `propose` / `proposals` / `vote` / `register-pods`, `solutions` / `solution-gallery` / `solution-vote` / `register-projects`. Reads `lib/cycles/{schedule,windows,lab-time,info}`, `lib/auth/windows`, `lib/projects/gallery-visibility`. | Window state is resolved phases-first by the same registry the write gate uses, so an "open" row never 403s on submit. |
| `pods/[pod_id]/` | Pod detail: the problem it formed around, the roster (members, its Poderator, admins only), follow + updates; org pods get `charter-project-form.tsx`. Reads `lib/pages/server`, `lib/auth/roles`, `lib/cycle/labels`. | `pulse-check-dashboard.tsx` lives here but renders only on the project page. |
| `projects/[project_id]/` | Project detail: the pitch, the team (gated the same way), DRI / contributor roles, the withdraw button, follow + updates, the owner Danger Zone. Reads `lib/auth/projects`, `lib/auth/windows`, `lib/pages/server`. | |
| `learning/` | `/learning`: the events agenda, the Learning Library grid, and the member's saved items. Reads `lib/content/queries`, `lib/content/saved`. | Lane L (#441) puts the "Before the cycle" shelf here. |
| `directory/` | `/directory`: people / pods / projects search with URL-shareable state, "People you may know", and the following feed (`updates-feed.tsx` is the shared feed reader, also used by the dashboard and profiles). Reads `lib/directory/data`. | Display-column allowlist only — no PII column is ever selected. |
| `network/` | `/network`: everything you follow (people and pages) with unfollow in place. Reads `lib/follows/data`, `lib/pages/authz`. | |
| `profile/` | `/profile` (your own profile) and `/profile/edit` (react-hook-form; also the forced name-completion mode the layout redirects to). Reads `lib/validations/participants-update`, `lib/participants/placeholder`, `lib/metros-label`. | |
| `u/[handle]/` | `/u/[handle]`: a member's profile as other members see it. Reads `lib/follows/data`. | Allowlist only; test / staff accounts 404. |
| `survey/[slug]/results/` | Role-adaptive field-survey results: full table + CSV for admins and the survey's Poderators, an anonymized aggregate for enrolled members. Reads `lib/content/{surveys,survey-results}`, `lib/auth/moderator`. | Self-guards: `/survey` is on the proxy's public list because the survey form lives in `app/(survey)/`. |
| `pulse-check/` | The pre-July weekly pulse check: history plus a legacy submission form. Reads `pulse_checks` directly. | **Legacy** — the Learning Log gate replaced it; this page never locks. |
| **Poderator** | | |
| `moderator/` | `/moderator` (All pods: pod cards, the needs-attention rollup, cross-pod insights, cycle filter) and `/moderator/pods/[id]` (the per-pod shell: Overview, `logs`, `insights`, `feedback`, `roster`, `workshops`, `explore`), plus `cycles/[id]/submissions` and `vote-progress`. Reads `lib/moderator/*` (`pods-list`, `rollup`, `pod-context` — the guard, `log-health`, `pod-insights`, `workshops`, `ui-state`, `range`). | Conventions: [`docs/poderator-dashboard/CLAUDE.md`](../../docs/poderator-dashboard/CLAUDE.md). `pulse-insights` redirects to `insights`. Lane P (#461) adds the weekly goal card to the pod Overview and the safe logs-query bundle to `logs`. |
| **Admin** | | |
| `admin/layout.tsx`, `admin/_components/` | The admin shell: `requireAdmin()` (`lib/auth/guards`), the section rail, the always-on PROD / DEV banner. | |
| `admin/page.tsx`, `admin/cycles/[cycle_id]/` | The cycle list and the per-cycle workspace: config, status, the two log gates, participants, pods, revocations, workstreams, testing controls. Reads `lib/cycle/labels`, `lib/participants/placeholder`. | |
| `admin/org/`, `admin/labs/` | The organization surface (org cycles + the workstream directory) and the Local Labs directory with per-lab drill-in. | [`docs/ORG_CYCLES.md`](../../docs/ORG_CYCLES.md), [`docs/LOCAL_LABS.md`](../../docs/LOCAL_LABS.md). |
| `admin/people/`, `admin/access/`, `admin/participants/[participant_id]/permissions/` | People & Access (participants, invitations, bans, the permissions editor, member simulation, the owner Danger Zone), the read-only Access console over `participant_roles`, and the per-participant permissions page. Reads `lib/auth/roles`, `lib/auth/permissions`, `lib/env/project`. | |
| `admin/content/`, `admin/announcements/`, `admin/weekly-messages/`, `admin/tasks/`, `admin/surveys/`, `admin/feedback/` | The authoring tools: Library / events / spotlights, dashboard announcements, the weekly "What's next" messages, `custom_tasks` + the member-queue preview (`lib/tasks/preview`), field surveys (`lib/content/surveys`), feedback triage. | |
| `admin/explore/`, `admin/owner/` | The Entity Explorer (`lib/entity-explorer/*`) and the generalized owner console (`lib/owner/*`). | Flag-gated (`ENTITY_EXPLORER_ENABLED`, `OWNER_CONSOLE_ENABLED`); off by default → 404. |
| `admin/invitations/`, `admin/participants/page.tsx`, `admin/stories/` | Redirects into People & Access and Content. | Kept so old bookmarks land. |
| **Lab lead** | | |
| `lab/[slug]/` | `/lab/[slug]`: the lead's workspace — this lab's pods in the current cycle (the admin `PodsTable`, lab-scoped), internal workstreams, the member roster, invitations. `requireLabLead()` (`lib/auth/guards`). | [`docs/PRD-lab-lead-ux.md`](../../docs/PRD-lab-lead-ux.md); C4 #429 adds lab-scoped insights. |

## How it fits

[`proxy.ts`](../../proxy.ts) redirects every non-public path to `/login`; this group's `layout.tsx`
adds the member gates and the chrome. Pages read Supabase through `lib/` helpers (the service
client behind explicit allowlists, the user client where RLS is the gate); every mutation goes
through `app/api/`; shared pieces live in [`app/components/`](../components/README.md). The map
is [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md#directory-map) (roles under
[Core domain concepts](../../docs/ARCHITECTURE.md#core-domain-concepts)), tables are in
[`SCHEMA.md`](../../SCHEMA.md), and the requirements are
[`docs/PRD-moderator-dashboard.md`](../../docs/PRD-moderator-dashboard.md) (Poderator) and
[`docs/audit/SOCIAL_LAYER_ANALYSIS.md`](../../docs/audit/SOCIAL_LAYER_ANALYSIS.md) (social layer).

Three lanes of the
[hand-off brief](../../docs/roadmap/handoff-2026-09-28-onboarding-journeys.md) land in this folder:
**M** (§7.M, #412 / #413) builds the between-cycles dashboard mode — the "Still open this cycle"
and "Get ready for {cycle}" lists and the readiness ladder — in `dashboard/` and
`app/components/tasks/`; **P** (§7.P, #461) builds the Poderator's self-set weekly goal and the
safe logs query in `moderator/pods/[pod_id]/`; **L** (§7.L, #441) builds the "Before the cycle"
shelf in `learning/` (and the public `/library`). Its §6 rulings on shared files bind all three.

## Open issues in this area (snapshot 2026-10-02)

Live view: [label `area/frontend`](https://github.com/TheUpskillingLabs/OLOS/issues?q=is%3Aopen+label%3Aarea%2Ffrontend) ·
[all open issues](https://github.com/TheUpskillingLabs/OLOS/issues).

- [#412](https://github.com/TheUpskillingLabs/OLOS/issues/412) — A1 — Between-cycles dashboard mode: the two lists ("Still open this cycle" / "Get ready for {next cycle}") (`priority/p1, size/l, persona/pre-registrant`)
- [#413](https://github.com/TheUpskillingLabs/OLOS/issues/413) — A2 — Readiness ladder: nine steps, verified where the platform can and manual ticks where it cannot (`priority/p1, size/m, persona/pre-registrant`)
- [#417](https://github.com/TheUpskillingLabs/OLOS/issues/417) — A5 — Alumni & contributor pathways: `projects.seeking_contributors`, alumni interest capture, the alumni state at close-out (`priority/p2, size/m, persona/pre-registrant`)
- [#415](https://github.com/TheUpskillingLabs/OLOS/issues/415) — A6 — Waitlist v2: three optional fields, the lab-less dashboard copy, and the city count (feedback #11) (`priority/p2, size/s, persona/pre-registrant`)
- [#99](https://github.com/TheUpskillingLabs/OLOS/issues/99) — Refactor problem proposal form for react (`good first issue`)
- [#383](https://github.com/TheUpskillingLabs/OLOS/issues/383) — Participant erasure: owner-gated Danger Zone is silently hidden; path undiscoverable and partially defective
- [#357](https://github.com/TheUpskillingLabs/OLOS/issues/357) — Admin permissions page: unscoped Moderator preset is un-revocable and grants nothing useful
- [#428](https://github.com/TheUpskillingLabs/OLOS/issues/428) — C3 — `/admin/insights` v1: cycle selector, five blocks, CSV export per block (`priority/p1, size/l`)
- [#429](https://github.com/TheUpskillingLabs/OLOS/issues/429) — C4 — Lab-scoped insights on `/lab/[slug]`: the lab lead's recruitment view (`priority/p2, size/s`)
- [#420](https://github.com/TheUpskillingLabs/OLOS/issues/420) — B1 — One Outreach tab per pod: who needs a nudge, why, last contact, suggested copy-for-Slack line (`priority/p1, size/m`)
- [#423](https://github.com/TheUpskillingLabs/OLOS/issues/423) — B4 — Pods→Projects scoping (decide #378 Gap 1) + project-scoped log view and roster + switcher groups (`priority/p1, size/m`)
- [#425](https://github.com/TheUpskillingLabs/OLOS/issues/425) — B6 — Copy-for-Slack digest per project: recent reflections (accomplished / exploring / next focus), never health metrics (`priority/p2, size/s`)
- [#461](https://github.com/TheUpskillingLabs/OLOS/issues/461) — B7 — Lane P: the Poderator's weekly goal — a self-set reach target, "Reached" records in `outreach_log`, the loop line, and the safe "This week's logs query" bundle (`priority/p1, size/m`)
- [#462](https://github.com/TheUpskillingLabs/OLOS/issues/462) — B8 — The All-pods view and rollup read `pulse_checks` only, so every log-era pod shows 0 missing / healthy / At risk 0 (`priority/p1, size/s`)
- [#464](https://github.com/TheUpskillingLabs/OLOS/issues/464) — D6 — Admin editor for `cycle_events` and `cycles.description` / `what_you_build`: a new cohort's dates and public copy without a deploy (`priority/p1, size/s`)
- [#469](https://github.com/TheUpskillingLabs/OLOS/issues/469) — CV2 — Builder track: the `builder_join` window, `cycle_enrollments.tier` stamped at agreement, a ceremony that names only the events still ahead, the register-card copy, and the pod's "ready for builders" chip (`priority/p1, size/m`)
- [#470](https://github.com/TheUpskillingLabs/OLOS/issues/470) — CV3 — Contributor track: "request to contribute" on a graduated project (after A5 #417), resolved by the DRI through the existing contributors route; standalone reflections as the cadence (`priority/p2, size/s`)
- [#471](https://github.com/TheUpskillingLabs/OLOS/issues/471) — CV4 — Problem statements: a review / return-to-author status with a note, instead of delete-as-the-only-lever (`priority/p2, size/s`)
- [#435](https://github.com/TheUpskillingLabs/OLOS/issues/435) — S2.2 — Feed reader v2: events interleaved with shares on `/directory` and `/u/[handle]`; the dashboard teaser; the reactions decision (`priority/p2, size/m`)
- [#438](https://github.com/TheUpskillingLabs/OLOS/issues/438) — S2.5 — Mentor lite: the mentor-intent list, a briefing page per event or pod, outreach-log reuse (`priority/p2, size/m`)
- [#439](https://github.com/TheUpskillingLabs/OLOS/issues/439) — S2.6 — Learning Log write-up export: the per-member cycle record and the per-project digest (the "record you'll draw on" promise) (`priority/p2, size/m`)
- [#106](https://github.com/TheUpskillingLabs/OLOS/issues/106) — [frontend] form accessibility — add aria-required, aria-invalid, aria-describedby to Field primitives (`good first issue, priority/p2, size/s`)
- [#105](https://github.com/TheUpskillingLabs/OLOS/issues/105) — [backend+frontend] harden LinkedIn URL handling — validate format + sanitize render (`good first issue, priority/p2, size/s`)
- [#377](https://github.com/TheUpskillingLabs/OLOS/issues/377) — Poderator roster export: cycle/pod/project selection builder (backlog)
- [#378](https://github.com/TheUpskillingLabs/OLOS/issues/378) — Pods→Projects transition: poderator scoping, project-level log views, and switcher rethink

This list is a snapshot; the live view above is the truth. Refreshed at each sprint boundary
([`docs/roadmap/documentation-framework.md` §9.1](../../docs/roadmap/documentation-framework.md)).

## Before you change something

- **Tests.** `npm run test` runs Vitest over `lib/**/*.test.ts` only — nothing here has a test
  harness. Put new logic in `lib/` with a test and keep the page thin; `npm run lint` and
  `npm run build` are the checks that do see this folder.
- **PII.** Member-facing pages read `participants` through display-column allowlists (see
  `directory/page.tsx`, `u/[handle]/page.tsx`) on the service client. Never widen the participants
  RLS to make a page work; pulse and log data never render on a pod or project page.
- **Poderator surfaces.** "Poderator" in copy, `moderator` in code, tables, and paths; read
  [`docs/poderator-dashboard/CLAUDE.md`](../../docs/poderator-dashboard/CLAUDE.md) first.
- **Tasks and dates.** Anything task-shaped goes through `app/components/tasks/` (its
  [`CLAUDE.md`](../components/tasks/CLAUDE.md)), and member-facing dates render only via
  `lib/cycles/lab-time`.
- **Copy and constitution.** "The Labs" (never "TUL"), "Upskiller", "Poderator"; never course /
  class / student / lesson / module in UI. No in-app LLM, no activity telemetry, nothing that
  shames a member who is behind; messaging is consent-gated.
- **Done means** CI green, a `CHANGELOG.md` line, a wireframe before a new page or mode, a
  decision note when you chose something, and a migration number claimed on the issue before
  you write one — [`CONTRIBUTING.md`](../../CONTRIBUTING.md) and
  [`docs/roadmap/documentation-framework.md` §5](../../docs/roadmap/documentation-framework.md).
