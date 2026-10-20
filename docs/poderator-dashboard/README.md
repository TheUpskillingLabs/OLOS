# `docs/poderator-dashboard/` — the Poderator dashboard, for humans

| | |
|---|---|
| **What this is** | The human companion to [`CLAUDE.md`](CLAUDE.md): what the Poderator dashboard (the `/moderator` routes) is, which documents describe it, and what is open against it. |
| **Zone / owner** | This folder is the `docs` zone. The code it describes is the **single-owner** zone: `lib/moderator/` and `app/api/moderator/` (with `lib/enrollment/` and `app/api/admin/pods/`) belong to one `backend` teammate at a time; the pages under `app/(dashboard)/moderator/` are `frontend` ([`../agent-teams.md`](../agent-teams.md) "File-ownership map"). |
| **Conventions** | Agent conventions: [`CLAUDE.md`](CLAUDE.md) — the Poderator (UI) vs `moderator` (code, DB, routes) split, the route structure, the auth pattern, and the PRD decisions that are not re-litigated without a new decision entry. Its migration numbers are historical. |
| **Last verified** | 2026-10-02 |

## What is here

| Path | What it is | Notes |
|---|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Agent context for the dashboard | Canonical area context in the doc map |
| `README.md` | This file | |

## The dashboard in one paragraph

A Poderator shepherds one or more pods for one cycle. The dashboard is their signed-in
surface: who in the pod needs a hand this week and why, the pod's Learning Logs, a roster, and
the cycle's submissions and vote state. Routes live under `app/(dashboard)/moderator/` (code
and URLs say `moderator`; rendered copy says Poderator). Access resolves on every request from
`moderator_assignments` through `lib/auth/` (`isModerator`, `moderatorPodIds`); admins see
every pod.

| Route | What it shows (verified 2026-10-02) |
|---|---|
| `/moderator` | All-pods view: pod cards grouped by lab, the members-needing-attention rollup, cross-pod insights, a cycle filter, the pod switcher. A single-pod Poderator lands on their pod instead. |
| `/moderator/pods/[pod_id]` | Per-pod Overview. Tabs (`_nav/pod-nav.tsx`): Workshops `/workshops`, Learning & Milestone Logs `/logs`, Insights `/insights` (the copy-prompt bundle for the Poderator's own AI tool), Pod Feedback `/feedback`, Roster `/roster`; plus `/explore`, the pod-scoped slice of the read-only Entity Explorer with CSV export. `/pulse-insights` is a permanent redirect to `/insights` (folded in 2026-08-30). |
| `/moderator/cycles/[cycle_id]/submissions` | Project submissions and the "who still needs a nudge" outreach list, with CSV and copy-for-Slack export. |
| `/moderator/cycles/[cycle_id]/vote-progress` | Vote progress for the cycle. |

Server logic: [`lib/moderator/`](../../lib/moderator/) (pods list, rollup, pod detail, nudges,
log health and insights, phase guidance, UI state; tests in `nudges.test.ts`,
`pods-list.test.ts`, `log-insights.test.ts`). API:
[`app/api/moderator/`](../../app/api/moderator/) (pods, pod detail, per-member pulse
responses, recent logs and pulses, explore export, nudge dismissal, UI state). Tables:
`moderator_assignments`, `nudge_dismissals`, `moderator_ui_state`, `learning_logs` (the
cadence for log-era pods), `pulse_checks` (legacy); see [`SCHEMA.md`](../../SCHEMA.md).

## Which documents describe it

| Document | Status | Read it for |
|---|---|---|
| [`../PRD-moderator-dashboard.md`](../PRD-moderator-dashboard.md) | Historical (built; re-pointed to Learning Logs) | the problem, goals, and functional requirements; **§10 decisions log still governs** |
| [`../PRD-moderator-dashboard-mockups.html`](../PRD-moderator-dashboard-mockups.html) | Historical | the three mid-fi screens (All pods, Per-pod, Pulse review); open in a browser |
| [`../superpowers/specs/2026-05-22-poderator-dashboard-design.md`](../superpowers/specs/2026-05-22-poderator-dashboard-design.md) | Historical | the implementation design the build started from ([`../superpowers/README.md`](../superpowers/README.md)) |
| [`../requirements/moderator-insights-logs.md`](../requirements/moderator-insights-logs.md) | Likely shipped (PRs #379/#381) — verify and mark | re-pointing Insights from `pulse_checks` to `learning_logs`; the BYO-LLM bundle |
| [`../roadmap/handoff-2026-09-28-onboarding-journeys.md`](../roadmap/handoff-2026-09-28-onboarding-journeys.md) §2.4 and §7.P | Hand-off; binding for lane P | the current reading of the Poderator's week, and the weekly-goal lane |
| [`../roadmap/next-sprint.md`](../roadmap/next-sprint.md) §3 and §10 | Plan of record | Workstream B, the outreach toolkit (epic #395) |
| [`../ARCHITECTURE.md`](../ARCHITECTURE.md) "Roles" | Canonical | where the Poderator sits among the roles |

## Open issues in this area (snapshot 2026-10-02)

Live view: [all open issues](https://github.com/TheUpskillingLabs/OLOS/issues).

- [#420](https://github.com/TheUpskillingLabs/OLOS/issues/420) — B1 — One Outreach tab per pod: who needs a nudge, why, last contact, suggested copy-for-Slack line (`priority/p1, size/m`)
- [#421](https://github.com/TheUpskillingLabs/OLOS/issues/421) — B2 — `outreach_log`: record that a Poderator reached out (channel, note), visible to that pod's Poderators and admins only (`priority/p1, size/m`)
- [#422](https://github.com/TheUpskillingLabs/OLOS/issues/422) — B3 — The loop: "contacted last week → filed a log within 7 days" on the Poderator Insights page (`priority/p1, size/s`)
- [#423](https://github.com/TheUpskillingLabs/OLOS/issues/423) — B4 — Pods→Projects scoping (decide #378 Gap 1) + project-scoped log view and roster + switcher groups (`priority/p1, size/m`)
- [#462](https://github.com/TheUpskillingLabs/OLOS/issues/462) — B8 — The All-pods view and rollup read `pulse_checks` only, so every log-era pod shows 0 missing / healthy / At risk 0 (`priority/p1, size/s`)
- [#463](https://github.com/TheUpskillingLabs/OLOS/issues/463) — B9 — `synthesizeLogCadence` has no join-date floor: a member who joins a pod in week 6 reads as at-risk immediately (`priority/p1, size/s`)
- [#461](https://github.com/TheUpskillingLabs/OLOS/issues/461) — B7 — Lane P: the Poderator's weekly goal — a self-set reach target, "Reached" records in `outreach_log`, the loop line, and the safe "This week's logs query" bundle (`priority/p1, size/m`)
- [#377](https://github.com/TheUpskillingLabs/OLOS/issues/377) — Poderator roster export: cycle/pod/project selection builder (backlog)
- [#378](https://github.com/TheUpskillingLabs/OLOS/issues/378) — Pods→Projects transition: poderator scoping, project-level log views, and switcher rethink
- [#179](https://github.com/TheUpskillingLabs/OLOS/issues/179) — Harvest Pulse features into Learning Log: moderator roster health + reflection insights

This list is a snapshot; the live view above is the truth. Refreshed at each sprint boundary
([`../roadmap/documentation-framework.md`](../roadmap/documentation-framework.md) §9.1).

## Before you change something

- Read [`CLAUDE.md`](CLAUDE.md) first, and [`lib/auth/CLAUDE.md`](../../lib/auth/CLAUDE.md)
  before any guarded route.
- Single-owner zone: check that no other lane or open PR is in `lib/moderator/` or
  `app/api/moderator/` before you start (hand-off brief §6.1 has the merge order).
- `npm run test` runs the `lib/moderator/*.test.ts` suites; add a case for anything you
  change in nudges, the pods list, or the log-insights bundle.
- A migration: claim the number on the issue first (`ls supabase/migrations | tail -1`), and
  update `SCHEMA.md` in the same PR. The PR also needs a `CHANGELOG.md` line.
- The constitution, as it applies here: no in-app LLM (the Insights block copies a bundle to
  the clipboard; the model is the Poderator's own); no activity telemetry; nothing that
  shames a member — status words name the cadence ("missed last week"), never the person.
  The private tier of a log (ratings, blocked flag, blocker context) stays between the
  member, their Poderator, and admins; the outreach log is proposed as visible to the pod's
  Poderators and admins only, never members (next-sprint.md §7, decision D8, still pending).
- Copy: "Poderator" in every rendered string, `moderator` in every identifier; "The Labs",
  never "TUL"; "Upskiller"; never course / class / student / lesson / module.
- Branch and PR workflow: [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md).
