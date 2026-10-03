# Cycle 4 readiness: the paper trail for an 8-week internal retrospective

| | |
|---|---|
| **Date** | 2026-10-03 |
| **Ran by** | Claude Code session for the maintainers (https://claude.ai/code/session_016wuEPmUQtKEWY7fEfvU5Tr) |
| **Branch / PR** | `claude/dazzling-wright-f0ev4k` · PR into `dev` (this report's PR) |
| **Asked** | "Create the paper trail and additions to the roadmap and project context documents so this happens without unnecessary conflicts later. Bring more through an API rather than hard-coding; keep the 12-week visuals; make the next Build Cycle go smoothly while structuring toward long-term norms." |

## What was done

- **Session start.** Read the 2026-10-02 Sprint 1 hand-off and the lane brief, mapped the
  code (dashboard and tasks, public pages, signup funnel, cycle state), and drafted the
  Sprint 1 plan for lane M: user assumptions and two workflow diagrams. The plan is a
  private page for the team. No application code changed.
- **Owner input folded in:**
  - Cycle 4 is 8 weeks, a retrospective over Cycles 1–3 (D1, 2026-10-02).
  - Cycle 4 has no public registration front door (an ops thread on 2026-10-03).
  - That thread's proposed runbook (move the cycle to `draft`, a wording pass, close
    Cycle 3) was reviewed against the code.
- **New spec:** [`../requirements/cycle-4-readiness.md`](../requirements/cycle-4-readiness.md).
  - The norms: cycle facts are data behind an API; lifecycle separate from audience; the
    12-week template kept as the default; two-fixture tests; reversible by default.
  - Why neither `draft` nor `mode='closed'` fits.
  - A 15-row inventory of what assumes 12 weeks, verified against `dev@448fceb`.
  - The run sheet: now, first PRs, before Kickoff, at Cycle 3 close.
  - How it avoids lane conflicts, and the decisions log.
- **Issues filed:**
  - [#477](https://github.com/TheUpskillingLabs/OLOS/issues/477): the epic and run sheet.
  - [#478](https://github.com/TheUpskillingLabs/OLOS/issues/478): `cycles.registration_audience`, which claims migration `00108`.
  - [#479](https://github.com/TheUpskillingLabs/OLOS/issues/479): real 7-day cycle weeks.
  - [#480](https://github.com/TheUpskillingLabs/OLOS/issues/480): a *Decision needed*
    issue for Cycle 4's format, audience and close-out.
- **Context documents updated:**
  - `docs/requirements/cycle-timeline.md`: a template note, a 2026-10-03 decisions-log
    entry, and open decision T-4.
  - `docs/roadmap/next-sprint.md`: §7 D1 shape, §8 status (#476 merged; Cycle 4
    readiness), §9 risk, §10 issue map.
  - `docs/roadmap/handoff-2026-09-28-onboarding-journeys.md`: `00108` added to the three
    migration lists, plus the D1 row and the D1 gate.
  - `docs/README.md` and `docs/requirements/README.md`: the doc map entries.
  - "Cycle facts are data" rule added to `AGENTS.md`, `ONBOARDING.md` and `lib/README.md`.
  - `CHANGELOG.md`: one Docs line.

## What was verified

- Every code claim in the inventory was read from `dev@448fceb`:
  - `lib/cycle/week.ts` 13-slice formula;
  - `at-risk.ts` → `compliance-logic.ts`;
  - `synthesizeLogCadence`;
  - `phase.ts` fallback thresholds;
  - `lib/validations/cycles.ts` `max(12)`;
  - `getRecruitingCycle` / `selectMemberCycles` resolving only `upcoming`;
  - `mode='closed'` semantics (`00049`, `status` route);
  - the hard-coded strings in `app/page.tsx`, `/build-cycles`, `/local-labs/[slug]`, the funnel;
  - `vercel.json`: revocation cron unscheduled, Friday log-window cron scheduled.
- `npm run check:docs` and `npm run check:migrations` pass; results are in the PR body.

## Decisions made → where they live

| Decision | Recorded in |
|---|---|
| Cycle 4 is 8 weeks, a retrospective, internal (owner) | `next-sprint.md` §7 D1; `cycle-4-readiness.md` §7 |
| *Proposed:* audience separate from lifecycle (`00108`); real 7-day weeks; keep the 12-week template; two-fixture tests | `cycle-4-readiness.md` §2–§3; `cycle-timeline.md` decisions log; ratify in #480 (a vault note once #391 merges) |

## Open questions / needs from others

- **The owner** decides #480: audience `members` vs `invite`, the arc in 8 weeks, past
  projects reopened, whether Cycle 3's project close-out waits, the ladder copy, and
  Cycle 4's dates. Items 4 and 7 are needed before Oct 13.
- **Ops:**
  - check for Cycle 4 pre-registrations and send any notes;
  - confirm Cycle 3's join path is closed;
  - keep `/api/cron/revocation-check` unscheduled until #479 merges.
- **Lane S** takes #479 (it owns `lib/cycle/week.ts`).
- **The volunteer developer** (#414) is asked, on the issue, to prioritise the
  "no cycle open" state and to read the audience field.

## Next

- #463 (join-date floor, written against dates) on `fix/log-cadence-join-date-floor`,
  then lane M-core (#412/#413) on `feat/between-cycles-dashboard`. The dashboard reads the
  audience through `selectMemberCycles` and never hard-codes cycle length or theme.
- #478 once #480 item 1 is decided.
