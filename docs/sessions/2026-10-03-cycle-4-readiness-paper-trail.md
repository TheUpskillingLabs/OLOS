# Cycle 4 readiness: the paper trail for an internal cycle without a public front door

| | |
|---|---|
| **Date** | 2026-10-03 |
| **Ran by** | Claude Code session for the maintainers (https://claude.ai/code/session_016wuEPmUQtKEWY7fEfvU5Tr) |
| **Branch / PR** | `claude/dazzling-wright-f0ev4k` · PR into `dev` (this report's PR) |
| **Asked** | "Create the paper trail and additions to the roadmap and project context documents so this happens without unnecessary conflicts later." Then refined: no change to how weeks are counted and no new technical debt. The hot fix is keeping the cycle off the website's main page. Run the cycle live without public registration. Manage expectations. Keep members engaged with materials and notifications while they wait. |

## What was done

- **Session start.** Read the 2026-10-02 Sprint 1 hand-off and the lane brief, mapped the
  code (dashboard and tasks, public pages, signup funnel, cycle state), and drafted the
  Sprint 1 plan for lane M: user assumptions and two workflow diagrams. The plan is a
  private page for the team. No application code changed.
- **Owner and board input folded in:**
  - Cycle 4 is internal, about 8 weeks, built around the data and projects of Cycles 1–3.
  - The board: "Doing it closed to focus on ourselves/alleviate capacity. The hot fix is
    just making sure it's not on our website's main page."
  - The ops thread's runbook was reviewed against the code.
- **New spec:** [`../requirements/cycle-4-readiness.md`](../requirements/cycle-4-readiness.md):
  - **The hot fix:** data only, with read-only check SQL and the `draft` update, and what
    the banner shows before and after Oct 13.
  - **Live but not public:** the existing org-cycle track (`mode='org'`, no code) or a
    members-only participant cycle (#478).
  - **Copy that promises something,** for expectation management.
  - **What members can be sent now** with existing admin tools: member tasks,
    announcements, the Library.
  - **The known 12-week limitations,** with no change planned.
  - **The lane-conflict notes** and a light "cycle facts are data in new code" habit.
- **Issues:**
  - [#477](https://github.com/TheUpskillingLabs/OLOS/issues/477): epic, re-scoped to the
    board's order.
  - [#478](https://github.com/TheUpskillingLabs/OLOS/issues/478): `cycles.registration_audience`,
    claims `00108`. Kept as the general mechanism; on the critical path only if #480
    picks it.
  - [#480](https://github.com/TheUpskillingLabs/OLOS/issues/480): decision.
  - [#479](https://github.com/TheUpskillingLabs/OLOS/issues/479) (week counting): filed,
    then **closed as not planned** on the owner's call. My comments on #460 and #392 were
    edited to match.
  - Cross-references posted on #414, #412 and #437.
- **Context documents updated:**
  - `next-sprint.md`: §7 D1, §8 status (#476 merged at `448fceb`; Cycle 4 readiness),
    §9 risk, §10 issue map.
  - The lane brief: `00108` in the migration lists, the D1 row and gate.
  - `cycle-timeline.md`: a template note and a 2026-10-03 "no change to week counting"
    entry.
  - `docs/README.md` and `docs/requirements/README.md`: the doc map and requirements index.
  - The habit line in `AGENTS.md`, `ONBOARDING.md` and `lib/README.md`.
  - `CHANGELOG.md`.

## What was verified

- **The banner.** It reads `getRecruitingCycle`: `upcoming`, else `active`, `mode='open'`,
  HQ. `draft` hides a cycle from every reader, `/c/[id]` included. The no-cycle banner
  copy promises a notification.
- **Org cycles.** They are excluded from `getRecruitingCycle` and the signup email. They
  are invite-only, with self-serve registration rejected (`lib/cycle/guards.ts`), and
  limited to one active and one upcoming per lab. `/c/[id]` does not 404 them: a known gap,
  routed to #414.
- **Existing admin tools.** `custom_tasks` with no cycle render for every member
  (`lib/tasks/tasks.ts` `resolveCustomTasks`); announcements are org-wide or per lab
  (`00070`); `cycle_config.log_gate_paused` exists (`00040`).
- **Crons.** Per `vercel.json`, the revocation cron is unscheduled and the Friday
  log-window cron is scheduled.
- **Checks.** `npm run check:docs` and `npm run check:migrations` pass.

## Decisions made → where they live

| Decision | Recorded in |
|---|---|
| Cycle 4 is internal, run closed; the hot fix is keeping it off the main page (owner, board) | `cycle-4-readiness.md` §9; `next-sprint.md` §7 D1 |
| No change to how cycle weeks are counted; no new technical debt (owner) | `cycle-4-readiness.md` §6, §9; `cycle-timeline.md` decisions log; #479 closed |
| *Proposed:* hot fix by `draft`; Cycle 4 as an org cycle; #478 as the general mechanism; general "no cycle open" copy | `cycle-4-readiness.md` §2–§4; ratify in #480 |

## Open questions / needs from others

- **The owner** decides #480: org cycle vs members-only, the log gate, the homepage and
  email copy, the timing of Cycle 3's project close-out, past projects, and the dates.
- **Ops runs the hot fix** (cycle-4-readiness §2):
  - check pre-registrations and send any notes;
  - move Cycle 4 to `draft`;
  - confirm Cycle 3's join path is closed;
  - if Option A, check that HQ has no other active or upcoming org cycle.
- **The volunteer developer** (#414): the homepage no-cycle copy, and `/c/[id]` returning
  404 for org cycles.

## Next

- #463 on `fix/log-cadence-join-date-floor`, then lane M-core (#412/#413) on
  `feat/between-cycles-dashboard`: the dashboard for members who aren't in a cycle.
- #478 if #480 picks a members-only participant cycle.
