# Requirements — Cycle Timeline & Scheduling

| | |
|---|---|
| **Status** | Draft — for review |
| **Author** | (you) |
| **Last updated** | 2026-06-17 |
| **Related code** | `cycles` + `cycle_config` (00001), `00006_add_cycle_phases`, `app/api/cycles/[cycle_id]/advance-phase/route.ts`, `lib/auth/windows.ts`, `app/api/cycles/[cycle_id]/config/route.ts` |
| **Related docs** | [`pod-registration.md`](./pod-registration.md) (its forming/active windows become phases here), `docs/OLOS-architecture-brief.md` (phase machine) |

## Overview

Cycle scheduling is being made **first-class**. Today the timeline is a loose
bag of independent timestamps; this redesign makes a cycle own an **ordered,
validated, timezone-aware schedule** from which every phase window — including
pod forming/active — is **derived**.

## Current state (as-is) — why this is needed

Three disconnected notions of time exist, with no relationship between them:

1. **Cycle envelope** — `cycles.start_date`/`end_date` (`TIMESTAMP NOT NULL`).
   Set at creation and **never read by any logic**. Decorative.
2. **Phase windows** — twelve `cycle_config.*_open/*_close` `TIMESTAMP` columns
   (problem_statement, voting, pod_registration, solution_proposal,
   solution_voting, project_registration). The real timeline. Set by admin PATCH
   or by `advance-phase`, which hardcodes a **24-hour** window per phase.
3. **Hardcoded offsets in code** — 7-day pulse enforcement, 30-day invite TTL,
   3/1/0-day reminders, the 24h phase duration.

Problems: windows have **no link to the cycle envelope**, **no validation**
(`open<close`, ordering, overlap, within-cycle all unchecked), are **manual-only
to advance**, use **naive `TIMESTAMP`** (implicit UTC → an admin entering DC-local
times is off by ~5 hours), and adding a phase means adding **columns**. The
deprecated `phase_2_start`/`phase_3_start` (00006) linger unused.

## Goals

- A cycle has **one schedule**; phases are ordered segments of it.
- Phase windows are **derived** from a cycle start + per-phase durations — change
  the start, the whole schedule shifts; **spine** phases can't overlap or go out
  of order by construction (overlay windows like pod active-join anchor
  independently and may overlap — see Target model).
- **Timezone-aware:** "midnight" means local midnight in the cycle's timezone.
- Adding a phase (e.g. pod forming/active) is **data, not schema**.

## Non-goals

- Reworking pulse-check cadence / invite TTL into config (related; D-5).
- Migrating *every* lifecycle timestamp (created_at, joined_at, …) to
  `timestamptz` — only the scheduling/anchor fields are in scope (D-6).

## Target model

### Anchor + timezone

- `cycles.start_at TIMESTAMPTZ` — the schedule anchor.
- **`labs.timezone TEXT`** — IANA zone (e.g. `America/New_York`), default DC's
  zone. **Timezone is a lab property** (D-4); a cycle uses its lab's zone.
  Wall-clock inputs ("close at 23:59") are interpreted in it and stored as
  `timestamptz` instants; display converts back.
- `cycles.end_at` becomes **derived** (anchor + sum of phase durations), not a
  free field.

### Phases as rows (`cycle_phases`)

Replace the twelve `cycle_config` window columns with:

    cycle_phases(
      id, cycle_id FK,
      phase_key,        -- 'problem_statement' | 'voting' | 'pod_forming'
                        --  | 'pod_active_join' | 'solution_proposal'
                        --  | 'solution_voting' | 'project_registration'
      kind,             -- 'spine' (sequential) | 'overlay' (independent)
      position SMALLINT,-- order, for spine phases
      anchor,           -- what it's relative to (cycle start, or an event)
      duration INTERVAL,-- how long this phase runs
      starts_at TIMESTAMPTZ,  -- computed
      ends_at   TIMESTAMPTZ,  -- computed
      UNIQUE(cycle_id, phase_key)
    )

- **Spine phases** (`problem_statement`, `voting`, `pod_forming`,
  `project_proposal`, `project_voting`, `project_registration`) chain
  contiguously: `starts_at = prev.ends_at` (first = anchor); ordered and
  non-overlapping **by construction**.
- **Overlay windows** (`pod_active_join`, and the always-on pulse track) anchor
  **independently** (to an event ± offset) and **may overlap** the spine — e.g.
  in Cycle 3 pod active-join (Aug 11→25) deliberately spans the entire project
  stage. Overlaps are allowed *for overlays*, not within the spine.
- `starts_at`/`ends_at` are stored (cached) and recomputed when the anchor,
  any duration, or a referenced event date changes.
- A window is "open" iff `now ∈ [starts_at, ends_at)` — `lib/auth/windows.ts`
  reads `cycle_phases` instead of `cycle_config` columns.
- **Pod forming/active** are two phase rows — `pod_forming` (spine) and
  `pod_active_join` (overlay) — replacing the old `pod_registration`. This is the
  reconciliation with [`pod-registration.md`](./pod-registration.md).

### Two tracks: events vs. software actions

A cycle timeline has **two independent tracks** that share the calendar:

1. **Events** — community gatherings (Problem Sprint, Meet the Pods, Hackathon,
   Meet the Projects, Summit). **Pinned** to fixed, venue-bound dates that do not
   slide. Stored in `cycle_events`.
2. **Software actions** — the in-app windows where participants *act*: voting,
   registration (incl. pod forming/active-join), and submissions. These are the
   `cycle_phases`, derived by duration.

They interleave but are **not** one sequence — an event does not gate a software
action and vice-versa. (This resolves the earlier ordering confusion: the
Problem Sprint being after "pods formed" is fine because they're different
tracks.)

### Milestones / pinned events

Because events are fixed and software-action windows are derived, the timeline is
a **hybrid**: pinned event dates, with action windows filling the gaps.

    cycle_events(
      id, cycle_id FK,
      key,            -- 'problem_sprint' | 'meet_the_pods' | 'hackathon'
                      --  | 'meet_the_projects' | 'summit' | …
      label, occurs_at TIMESTAMPTZ,   -- pinned absolute instant (cycle tz)
      UNIQUE(cycle_id, key)
    )

- A phase boundary may be **pinned to a milestone** (e.g. `pod_forming` closes at
  the "pods formed" date) or **derived** by duration. Pinned beats derived; the
  schedule service computes the rest around the pins and validates they stay
  ordered/contiguous.
- Events are point-in-time markers; they don't gate app windows by themselves
  (a phase does that), but they anchor the schedule and drive comms/UI.

### Always-on tracks

Pulse checks run the whole cycle (no phase segment) — represented as spanning
`start_at`→`end_at`, not a `cycle_phases` row. Their cadence/enforcement stays as
today unless D-5 moves it to config.

### Advancement

Phases are **time-driven** (the clock opens/closes them via `starts_at`/`ends_at`)
— no admin click required to advance. `advance-phase` becomes an **override**:
"close current early / extend / shorten," which adjusts a duration and
**recomputes downstream** phases. The hardcoded 24h default is removed; each
phase has its own default duration.

## Cycle template — relative schedule (applies to any cycle)

The Cycle-3 dates (Appendix) are **one instance** of a reusable template. A cycle
is instantiated from a **start** date (a Tuesday) + **timezone** + the **event**
dates; every software-action window is then **derived** relative to an event.
Deadlines snap to a weekday ("the Tuesday following …"). Observed shape: a
**13-week, Tuesday-anchored** cycle; weekly deadlines on **Tuesdays**, the
project-registration deadline on a **Friday**.

Two relative layers:
- **Events** are offsets from **cycle start** — but carry only *defaults*; each
  is **per-cycle overridable** (venues book independently).
- **Software-action windows** are offsets from their **anchor event** — so if an
  event date shifts, its windows follow it.

### Anchors

| Anchor | Relative rule (default) | Cycle 3 |
|---|---|---|
| Cycle **start** | input — a Tuesday + timezone | Tue Jul 14, America/New_York |
| **Problem Sprint** (event) | start + 11 days (Sat, wk 2) | Sat Jul 25 |
| **Meet the Pods** (event) | start + 4 weeks (Tue) | Tue Aug 11 |
| **Hackathon** (event) | start + 30 days (Thu, wk 5) | Thu Aug 13 |
| **Meet the Projects** (event) | start + 8 weeks (Tue) | Tue Sep 8 |
| **Summit** (event) = cycle **end** | start + 13 weeks (Tue) | Tue Oct 13 |

### Software-action windows (relative to anchor event)

| Window | Opens | Closes |
|---|---|---|
| Problem statement | Sprint, 9:00am | Sprint, 12:00pm |
| Pod voting | Sprint, 12:00pm | Sprint, 1:00pm |
| Pod registration (forming) | Sprint, 1:00pm | **Tuesday after Sprint**, midnight |
| Pod active-join | Meet the Pods, 12:00am | = Project registration close |
| Project proposal | Hackathon (Thu) | **Tuesday after Hackathon** |
| Project voting | Tuesday after Hackathon | **Thursday after Hackathon** |
| Project registration | Thursday after Hackathon | **2nd Tuesday after Hackathon** |

"**\<Weekday\> after X**" = the first such weekday strictly after X. The project
stage is a contiguous Thu→Tue→Thu→Tue chain off the Hackathon: proposal
Hackathon→next Tue; voting that Tue→that Thu; registration that Thu→the following
Tue. (Supersedes the earlier rough "voting til Tue / registration til Fri.")

### Mapping to the schema

- `cycles.start_at` + `labs.timezone` (via the cycle's lab) — the anchor.
- `cycle_events` rows — events: relative default + optional per-cycle override.
- `cycle_phases` rows — software-action windows, each storing its **anchor event
  + offset + time-of-day (+ weekday-snap)** rule; instantiating a cycle computes
  every `starts_at`/`ends_at` from these.

## Functional requirements

- **FR-1** Add `cycles.start_at TIMESTAMPTZ`; `end_at` derived. **Timezone lives
  on the lab** (`labs.timezone TEXT`, default `America/New_York`); a cycle uses
  its lab's timezone (D-4). All scheduling math/display uses it.
- **FR-2** Create `cycle_phases` (shape above); seed the default phase sequence
  with default durations on cycle creation.
- **FR-3** A schedule service computes/stores `starts_at`/`ends_at` for all
  phases from the anchor + durations; recomputes on any change.
- **FR-4** `lib/auth/windows.ts#checkWindow` reads `cycle_phases.starts_at/ends_at`
  (timezone-aware) instead of `cycle_config.*_open/close`.
- **FR-5** `advance-phase` becomes a duration-override/recompute action; remove
  the 24h hardcode.
- **FR-6** Validation: editing a duration or anchor keeps the **spine** ordered
  and contiguous automatically; overlay windows (pod active-join, pulse) anchor
  independently and may overlap the spine. Any explicit boundary override (D-2)
  must keep `start<end` and stay within the cycle.
- **FR-7** Admin schedule UI shows the derived timeline (phase → computed
  start/end in the cycle's tz) and edits durations/anchor, not raw timestamps.

## Schema & migration

- Add `cycles.start_at` (backfill from `start_date`) and `labs.timezone`
  (default `America/New_York`; cycles read it via their lab).
- Create `cycle_phases`; migrate the twelve `cycle_config.*_open/close` values
  into rows (derive each `duration` from the old open/close span; set `position`
  by `PHASE_SEQUENCE`), splitting old `pod_registration` into `pod_forming` +
  `pod_active_join`.
- **Convert all ~49 lifecycle `TIMESTAMP` columns to `timestamptz`** (audit found
  ~49, not ~40). **The interpretation is PER-COLUMN, not one blanket zone (revised
  on stress-test):**
  - **Audit columns** (`created_at`, `updated_at`, `granted_at`, `joined_at`, …) were
    written by `CURRENT_TIMESTAMP` in a **UTC** session → convert as **UTC**
    (`USING col AT TIME ZONE 'UTC'`). Reinterpreting these as Eastern would shift
    ~38 columns by +4-5h — **data corruption.**
  - **Scheduling columns** (the 12 `cycle_config.*_open/close`) are *candidates* for
    Eastern, but that depends on how the write path stored them (an admin PATCH that
    used `.toISOString()` already stored UTC wall-clock). **Verify against real prod
    values before choosing the zone per column.** This is the one irreversible data
    step — dry-run on a prod clone.
- Drop `phase_2_start` / `phase_3_start` and the `cycle_config.*_open/close`
  columns once `cycle_phases` is live.

## Date-reference audit — are we linking them all?

Every date reference in the codebase, classified by how it relates to the new
timeline. **L** = links to the cycle timeline (must read the new model);
**R** = replaced by it; **I** = independent track (intentionally *not* the
cycle schedule); **A** = audit/event record (not schedule, tz-cleanup only).

### Schedule (R — replaced by `cycle_phases` / `cycle_events`)
| Reference | Location | Disposition |
|---|---|---|
| `cycles.start_date` / `end_date` | `00001`; UI `cycles/page.tsx`, `[cycle_id]/page.tsx`, `cycle-phase-indicator.tsx` | → `start_at` (anchor) + derived `end_at` + `timezone` |
| `cycle_config.*_open/_close` (12 cols) | `00001` | → `cycle_phases` rows |
| `cycle_config.phase_2_start/phase_3_start` | `00006` | → dropped (already dead) |
| `advance-phase` (PHASE_SEQUENCE, 24h hardcode, now-logic) | `app/api/cycles/[cycle_id]/advance-phase/route.ts` | → compute from `cycle_phases`; advance = override+recompute |
| `updateCycleConfigSchema`, `createCycleSchema` | `lib/validations/cycles.ts` | → schedule/template validation |

### Window checks (L — THE risk: same logic re-implemented across 12 files)
The `now >= new Date(config.X_open) && now <= new Date(config.X_close)` pattern
is duplicated, each reading `cycle_config` columns directly with browser-local
`new Date()`. **Stress-test correction: it's 12 files, not ~9 — and the canonical
`checkWindow` is called by only the 6 API routes; all the UI pages re-derive it
inline and never call the resolver.** So FR-11 is "introduce server-side window
resolution into 12 UI pages," not "point 9 callers at one helper."

| File | Window |
|---|---|
| `lib/auth/windows.ts` `checkWindow` (server, canonical) | all (the one to keep + extend) |
| `(dashboard)/cycles/[cycle_id]/propose/page.tsx` | problem_statement |
| `(dashboard)/cycles/[cycle_id]/vote/page.tsx` | voting |
| `(dashboard)/cycles/[cycle_id]/register-pods/page.tsx` | pod_registration |
| `(dashboard)/cycles/[cycle_id]/register-projects/page.tsx` | project_registration |
| `(dashboard)/cycles/[cycle_id]/solutions/page.tsx` (+ `DAY_MS` tab/banner offsets) | solution_proposal |
| `(dashboard)/cycles/[cycle_id]/solution-vote/page.tsx` | solution_voting |
| `(dashboard)/cycles/[cycle_id]/page.tsx`, `cycle-phase-indicator.tsx` | all (loop + progress bar) |
| `app/api/registrations/short/route.ts` | pod_registration |
| `(dashboard)/dashboard/page.tsx` | *(missed in first audit)* |
| `(dashboard)/moderator/cycles/[cycle_id]/vote-progress/page.tsx` | *(missed in first audit)* |
| `(dashboard)/admin/cycles/[cycle_id]/testing-controls.tsx` | *(missed; uses `>` not `>=` on close — **bound bug**, fix during consolidation)* |

All must resolve windows through **one** tz-aware helper backed by `cycle_phases`
— not re-derive from columns. `windows.ts` `WindowField` must also gain the new
keys (`pod_forming`, `pod_active_join`, `project_proposal`) and update
`WINDOW_MESSAGES`.

### Independent tracks (I — NOT the cycle schedule; confirm they stay separate)
| Reference | Location | Note |
|---|---|---|
| 7-day pulse enforcement (`SEVEN_DAYS_MS`), baseline `last_pulse_completed_at ?? created_at` | `cron/revocation-check`, `pulse-checks/enforcement`, `(dashboard)/layout.tsx`, `pulse-check/page.tsx` | rolling per-participant, not cycle-relative (D-8) |
| 3/1/0-day pulse reminders | `cron/pulse-check-reminder` | tied to the 7-day deadline, not the cycle |
| Invite 30-day TTL (`expires_at` default + checks) | `00009`; `auth/callback`, `invitations` routes | per-invite, not cycle schedule |
| Cron schedules `0 9 * * *` / `0 10 * * *` (UTC) | `vercel.json` | → fire at **7am cycle-local** (decided, FR-15); UTC-only cron ⇒ pin equiv or gate hourly (DST) |
| `pulse_checks.scheduled_date` (DATE) | `00001` | day-level dedup key; "today" should be cycle-tz (minor) |

### Audit/event timestamps (A — not schedule; tz-cleanup only, D-6)
`created_at`, `updated_at`, `enrolled_at`, `inactive_date`, `granted_at`/
`revoked_at`, `accepted_at`, `assigned_at`/`removed_at`, `joined_at`/`inactive_at`,
`registered_at`/`left_at`, `completed_at`, `last_pulse_completed_at`,
`access_revocations.revoked_at`, `invitations.email_sent_at` (already `timestamptz`).
These record *when something happened* — they don't link to the timeline; only
the optional `timestamptz` consistency cleanup (D-6) applies.

### Added functional requirements

- **FR-11 (single window resolver)** Route **all** window checks — the **12 files**
  above — through one tz-aware helper backed by `cycle_phases`. The UI pages don't
  currently call `checkWindow` at all, so this is a real refactor of each page (move
  resolution server-side), not a one-line swap. Delete the inline
  `now >= open && now <= close` re-implementations and the per-file `DAY_MS`
  offsets (derive affordance windows from phase boundaries), and fix the `>` vs `>=`
  bound bug in `testing-controls.tsx`.
- **FR-12 (phase keys)** Extend `windows.ts` `WindowField` + `WINDOW_MESSAGES`
  to the new phase set (`pod_forming`, `pod_active_join`, `project_proposal`,
  …); it is the single enumeration of windows.
- **FR-13 (validation)** Replace `cycles.ts` config/window validation with
  schedule-template validation (anchor + event dates + durations).
- **FR-14 (display tz)** UI date formatting (`toLocaleDateString` etc.) renders
  in the **cycle's** timezone **and shows the tz label** — e.g.
  "Aug 13, 2026, 12:00 PM EDT", not the browser's local time.
- **FR-15 (cron tz)** Participant-facing crons (pulse reminders,
  revocation/participant-issue checks) fire at **7:00 AM cycle-local**. Vercel
  cron is UTC-only, so either pin the UTC equivalent (11:00 UTC EDT / 12:00 UTC
  EST — **DST caveat**) or run hourly and gate to the cycle's 07:00.

## Acceptance criteria

- Changing `cycles.start_at` shifts every phase boundary; phases stay ordered
  and contiguous with no manual edits.
- A window opens/closes by the clock at its computed boundary in the cycle's
  timezone (a 23:59 close in `America/New_York` closes at local 23:59, not UTC).
- Pod forming and pod active-join are two phases in the timeline; the
  pod-registration flow reads them like any other window.
- It is impossible to save **spine** phases that overlap or go out of order;
  **overlay** windows (pod active-join, pulse) may overlap the spine by design
  (e.g. pod active-join spans the project stage).

## Decisions log

- **2026-06-17** — Timeline is **cycle-relative / derived**: anchor +
  per-phase durations; spine windows computed/ordered/contiguous, overlay
  windows (pod active-join, pulse) anchored independently and may overlap.
- **2026-06-17** — **Timezone-aware**; timezone is a **lab** property
  (`labs.timezone`, default DC); cycles use their lab's zone. All timestamps
  stored `timestamptz`.
- **2026-06-17** — Phases are **rows** (`cycle_phases`), not columns; adding a
  phase is data. Pod forming/active are two such rows.
- **2026-06-17** — Hybrid timeline: **pinned milestones** (`cycle_events`,
  absolute dates that don't slide) + **derived phases** filling the gaps between
  them. Refines the pure-derived decision after real Cycle-3 dates showed
  several fixed, venue-bound events.
- **2026-06-17** — Dates are displayed **in the cycle's timezone with the tz
  label shown** (FR-14).
- **2026-06-17 (resolves D-9)** — Participant-facing crons fire at **7:00 AM
  cycle-local** (FR-15).
- **2026-06-17** — The schedule is a **reusable relative template**: events are
  offsets from cycle **start** (overridable per cycle); software-action windows
  are offsets from their **anchor event** with weekday-snap deadlines. Cycle 3
  is the first instance. Observed shape: 13-week, Tuesday-anchored.
- **2026-06-17 (resolves D-7)** — The timeline is **two independent tracks**:
  **events** (community gatherings, pinned) and **software actions** (in-app
  voting/registration/submission windows = `cycle_phases`, derived). They
  interleave but neither gates the other; an event's calendar position need not
  match the app's action order.

## Open decisions

*All resolved 2026-06-17 (decision sweep):*

- **D-1 → Adopt Cycle 3's durations** as the template defaults.
- **D-2 → Yes**, optional per-phase absolute pin allowed (default derived).
- **D-3 → PER-COLUMN (revised on stress-test).** *Audit* columns convert as **UTC**
  (`CURRENT_TIMESTAMP`-origin); only *scheduling* columns are Eastern candidates, and
  only after verifying real values. (Was: "all Eastern" — that corrupts ~38 UTC
  audit columns.)
- **D-4 → Lab-level** timezone (`labs.timezone`); cycles use their lab's zone.
- **D-5 → Keep as code constants** (pulse/invite/reminder offsets).
- **D-6 → Convert *all* lifecycle `TIMESTAMP` → `timestamptz`** now (one pass).
- **D-8 → Keep pulse/invite tracks independent** of the cycle timeline.

## Appendix — Cycle 3 initial scaffold (2026)

Seed dates to build the timeline against. **All times America/New_York; year
2026.** Two tracks (see model): events are pinned; software-action windows are
mostly TBD.

**Envelope**
- ✓ Cycle 3 **start** — Jul 14 (Cycle 2 ends)
- ✓ Cycle 3 **end** — Oct 13 (= Summit)

**Events track (pinned, defined)**

| Date | Event |
|---|---|
| Jul 25 | Problem Sprint *(new)* |
| Aug 11 | Meet the Pods |
| Aug 13 | Hackathon |
| Sep 8 | Meet the Projects |
| Oct 13 | Summit |

**Software-action windows track (`cycle_phases`)**

Windows anchor to events — some **pinned** to an event date, some **computed
relative** to one (e.g. "the Tuesday following"). Possible weekly-Tuesday
deadline cadence (confirm).

The **submission → voting → registration** chain repeats twice: compressed into
the sprint day (pod stage) and spread over a week (project stage). Both are
contiguous (each window opens when the prior closes). Deadlines land on
**Tuesdays and Fridays** (possible cadence convention). Hour-level precision ⇒
scheduling is `timestamptz` (Eastern). Weekdays: Hackathon Aug 13 = Thu;
"Tuesday" = Aug 18; "Friday" = Aug 21. "Midnight on the 28th" read as end-of-day.

**Pod stage (sprint day, Jul 25)**

| Window | Open → Close |
|---|---|
| Problem statement (submission) | ✓ **Jul 25 9:00am → 12:00pm** |
| Voting (problem statements) | ✓ **Jul 25 12:00pm → 1:00pm** |
| Pod forming (registration) | ✓ **Jul 25 1:00pm → Jul 28 midnight** |

**Project stage (week of the Hackathon)**

Terminology: a **project proposal** is the schema's `solution_proposals` row;
voting is `project_votes`; project registration is `project_memberships`.

| Window | Open → Close |
|---|---|
| Project proposal (submission; `solution_proposals`) | ✓ **Aug 13** (Thu, Hackathon) → **Aug 18** (Tue) |
| Voting (`project_votes`) | ✓ **Aug 18** (Tue) → **Aug 20** (Thu) |
| Project registration (`project_memberships`) | ✓ **Aug 20** (Thu) → **Aug 25** (Tue, next week) |

**Pod active-join window**

| Window | Open → Close |
|---|---|
| Pod active-join | ✓ **Aug 11 (Meet the Pods) → Aug 25 (project registration close)** |

Note: nothing happens between cycle start (Jul 14) and the Problem Sprint
(Jul 25) on the software-action track yet — confirm whether that gap holds
onboarding or another action.

**Fully specified.** Project-stage transitions (Aug 18 / 20 / 25) are at
**midnight** (decided). Cycle 3 is complete end to end.
