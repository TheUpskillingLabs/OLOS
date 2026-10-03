# Cycle 4 readiness: an internal org cycle, no public cycle until 2027, and the ops log

| | |
|---|---|
| **Date** | 2026-10-03 |
| **Ran by** | Claude Code session for the maintainers (https://claude.ai/code/session_016wuEPmUQtKEWY7fEfvU5Tr) |
| **Branch / PR** | `claude/dazzling-wright-f0ev4k` · PR into `dev` (this report's PR) |
| **Asked** | In order: create the paper trail so Cycle 4 happens without later conflicts. Then: don't change how weeks are counted, and create no new technical debt; the hot fix is keeping the cycle off the main page. Then: use the org cycle type ("build less with the same effect"); the next public cycle opens next year; keep OLOS signup open; keep a non-technical ticket where post-build actions are appended; focus this sprint on the between-cycles dashboard and touchpoints, the user journeys, the key measures, and a clear line of communication. |

## What was done

- **Session start.** Read the 2026-10-02 Sprint 1 hand-off and the lane brief, mapped the
  code, and drafted the lane M plan (user assumptions and two workflow diagrams) as a
  private page for the team. No application code changed this session.
- **Decisions recorded** (owner, 2026-10-03):
  - Cycle 4 runs as an **org cycle**.
  - The **next public cycle opens in 2027**, and nothing advertises a next cycle before then.
  - **OLOS signup stays open.**
  - **Week counting is unchanged.**
  - **#478** (members-only audience) is deferred and migration `00108` released.
  - **#479** is closed as not planned.
- **Issues:**
  - [#477](https://github.com/TheUpskillingLabs/OLOS/issues/477): the epic.
  - [#480](https://github.com/TheUpskillingLabs/OLOS/issues/480): the decision, now
    recorded. Still open: the log gate, Cycle 3's close-out timing, past projects, and
    the dates.
  - [#481](https://github.com/TheUpskillingLabs/OLOS/issues/481): **the ops log**, a
    plain-language running checklist for actions to take now, before Oct 13, as each
    technical PR lands, every month, and when the 2027 dates are set. PR authors append to it.
  - My comments on #414, #412, #460 and #392 were edited to the final decisions.
- **Specs and docs:**
  - [`../requirements/cycle-4-readiness.md`](../requirements/cycle-4-readiness.md):
    the plan of record for Cycle 4.
  - [`../roadmap/pre-registration-persona.md`](../roadmap/pre-registration-persona.md) §10:
    the long-gap addendum. It covers the journey from visitor to the 2027 announcement,
    which ladder rows hide while no cycle is announced, the line of communication (a
    pinned announcement, member tasks, Luma events), and seven between-cycles measures
    counted from tables.
  - `next-sprint.md`: §7 D1, §8, §9, §10.
  - The lane brief: the D1 row and gate. The `00108` claim was added and then removed.
  - `cycle-timeline.md`: a dated note.
  - The doc map and the requirements README.
  - The habit line ("cycle facts are data, in new code") in `AGENTS.md`, `ONBOARDING.md`
    and `lib/README.md`.
  - `CHANGELOG.md`.

## What was verified

- **The homepage banner** reads `getRecruitingCycle`: upcoming, else active, `mode='open'`,
  HQ. `draft` hides a cycle from every reader. The no-cycle banner copy promises a
  notification.
- **Org cycles.** They are excluded from the banner and the signup email. They are
  invite-only, with self-registration rejected in `lib/cycle/guards.ts`, and limited to
  one active and one upcoming per lab. They are created in Admin → Organization (the
  shared create form with the mode fixed). `/c/[id]` does not 404 them: a gap routed to #414.
- **Existing admin tools.**
  - `custom_tasks` with no cycle render for every member (`resolveCustomTasks`).
  - Announcements are org-wide or per lab.
  - `cycle_config.log_gate_paused` exists.
  - `event_rsvps.participant_id` exists (`00039`), and practice logs carry
    `learning_logs.cycle_id IS NULL`.
- **Crons:** the revocation cron is unscheduled.
- **Checks:** `npm run check:docs` and `npm run check:migrations` pass.

## Decisions made → where they live

| Decision | Recorded in |
|---|---|
| Cycle 4 is internal, run as an org cycle; the hot fix is keeping it off the main page | `cycle-4-readiness.md` §3, §9; #480 |
| The next public cycle opens in 2027; nothing advertises a next cycle before then; OLOS signup stays open | `cycle-4-readiness.md` §9; `pre-registration-persona.md` §10; #480 |
| No change to week counting; no new technical debt | `cycle-4-readiness.md` §6; `cycle-timeline.md`; #479 closed |
| A running non-technical ops log, appended as the build lands | #481; `cycle-4-readiness.md` §9 |

## Open questions / needs from others

- **The owner:** the remaining #480 items. Cycle 3's close-out timing is needed before
  Oct 13.
- **The public copy** (homepage banner, `/build-cycles`, the sign-up "Join a Cycle" card,
  the signup email) sits in the volunteer's reserved lane (#414). It needs either the
  volunteer to take it first, or an owner-approved narrow hot fix coordinated on #414.
- **Ops:** the "Now" section of #481. That covers the pre-registration check, the public
  row to `draft`, the org-cycle setup, the pinned announcement and the member tasks.

## Next

- #463 on `fix/log-cadence-join-date-floor`, then lane M-core (#412/#413) on
  `feat/between-cycles-dashboard`, designed to `pre-registration-persona.md` §10.

## Later the same session: the copy hot fix

- Docs PR #482 merged into `dev`.
- On the owner's instruction, a narrow copy hot fix (`fix/public-copy-no-next-cycle`) removed
  every public invitation to register for a next cycle:
  - the homepage banner, `/build-cycles`, the `/events` footnote and the local lab page;
  - the sign-up card and the welcome email;
  - the dashboard's no-cycle state.

  Each now says the next public cycle opens in 2027 and points to workshops, events and the
  Library. The year lives in `lib/cycles/next-public-cycle.ts`, tested; it falls back to
  "being planned" once 2027 has passed. These files sit in the volunteer's reserved lane
  (#414, #474), and the change is noted there.
- The same PR fixes the homepage's signed-out "Join The Labs", which went to plain `/login`.
  Follow-up checks were appended to the ops log #481.

