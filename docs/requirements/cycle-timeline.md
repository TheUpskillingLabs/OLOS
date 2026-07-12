# Requirements — Cycle Timeline & Scheduling

| | |
|---|---|
| **Status** | Draft — for review (**re-baselined 2026-07-12**; original 2026-06-17). The prescription survives; the "current state" it was written against has since grown a *fourth* time model. |
| **Related code** | `cycles` + `cycle_config` (00001, 00006, 00026, 00047), `lib/auth/windows.ts`, `lib/cycle/week.ts`, `lib/cycle/milestones.ts`, `lib/cycles/anchor-events.ts`, `00035_luma_sync`, `app/api/cycles/[cycle_id]/advance-phase/route.ts`, `vercel.json` |
| **Related docs** | [`pod-registration.md`](./pod-registration.md) (its two windows become phases here), [`local-labs.md`](./local-labs.md) (timezone home), [`implementation-plan.md`](./implementation-plan.md) |

## Overview

Cycle scheduling is being made **first-class**. Today the timeline is several
loose, unrelated bags of dates; this redesign makes a cycle own an **ordered,
validated, timezone-aware schedule** from which every window — including pod
forming/active-join — is **derived**, and into which the shipped week-calendar
and event tracks fold.

## Current state (as-is, July 2026) — four coexisting time models

The June version of this doc counted three disconnected notions of time. Prod
now has **four**, still with no relationship between them:

1. **Window columns** — twelve `cycle_config.*_open/_close` naive `TIMESTAMP`
   columns (problem_statement, voting, pod_registration, solution_proposal,
   solution_voting, project_registration). The real gating timeline. Set by
   admin PATCH or by `advance-phase`, which still hardcodes a **24-hour**
   window per phase (now explicitly a `testing:use` testing tool).
2. **Legacy phase markers** — `cycle_config.phase_2_start` / `phase_3_start`
   (`00006`). **Not dead** (the June doc was wrong by the time it merged):
   they drive `cycle-phase-indicator.tsx` ("Meet The Pods" / "Meet The
   Projects" progress) and are editable in the admin cycle-config form.
3. **The week calendar** — `cycles.start_date`/`end_date` (still naive
   `TIMESTAMP`) now **do** drive logic: `lib/cycle/week.ts#getCycleWeek`
   interpolates a 13-marker week grid, and `cycle_config.milestone_mid_week` /
   `milestone_final_week` (`00047`) schedule learning-log milestones **by week
   number**. `00048` orders cycles by these dates for the single-active-cycle
   invariant.
4. **Anchor events** — the cycle's six public events are a **hardcoded
   constant** (`lib/cycles/anchor-events.ts`, `start_at` "local ISO, no
   timezone — rendered as written"), self-described as interim until the Luma
   events cache (`00035_luma_sync`) serves them from the DB.

Cross-cutting problems, unchanged from June:

- **No validation** anywhere (`open<close`, ordering, overlap, within-cycle all
  unchecked) and no link between any of the four models.
- **Naive timestamps + no timezone anywhere.** No timezone column exists in
  the schema; every comparison is `new Date()` in whatever zone the runtime or
  browser happens to be in. An admin entering DC-local times is silently off
  by 4–5 hours.
- **Window logic is re-implemented everywhere.** `lib/auth/windows.ts#checkWindow`
  is the canonical server resolver (6 keys, naive compare; one improvement
  since June: it **rejects `mode='org'` cycles**, which must survive any
  refactor). It is called by ~8 API routes + `lib/projects/finalize.ts` — but
  the UI never calls it. `_open`/`_close` appears **~131 times across ~22
  files**; a dozen-plus pages re-derive
  `now >= new Date(open) && now <= new Date(close)` inline with browser-local
  `Date` (e.g. `cycles/[cycle_id]/register-pods/page.tsx`, `…/join/page.tsx`,
  `…/propose/page.tsx`, `…/vote/page.tsx`, `…/solutions/page.tsx`,
  `…/solution-vote/page.tsx`, `…/register-projects/page.tsx`,
  `dashboard/page.tsx`, `cycles/page.tsx`, `moderator/page.tsx`,
  `moderator/pods/[pod_id]/page.tsx`,
  `moderator/cycles/[cycle_id]/vote-progress/page.tsx`,
  `cycle-phase-indicator.tsx`, `admin/cycles/[cycle_id]/testing-controls.tsx`).
- Adding a phase still means adding **columns**.

## Goals

- A cycle has **one schedule**; phases are ordered segments of it; the week
  grid, milestones, and events read the **same anchor**.
- Phase windows are **derived** from a cycle start + per-phase durations —
  change the start, the whole schedule shifts; **spine** phases can't overlap
  or go out of order by construction (overlay windows anchor independently and
  may overlap).
- **Timezone-aware:** "midnight" means local midnight in the schedule's
  timezone.
- Adding a phase (e.g. pod forming/active-join) is **data, not schema**.

## Non-goals

- Reworking pulse-check cadence / invite TTL into config — those tracks stay
  independent of the cycle schedule (D-5/D-8).
- Changing the learning-log milestone *semantics* — milestone weeks stay
  admin-editable week numbers; only their underlying week grid gets re-anchored.
- Building the full Luma events cache — but `cycle_events` is designed to be
  its landing table (see below).

## Target model

### Anchor + timezone

- `cycles.start_at TIMESTAMPTZ` — the schedule anchor (backfilled from
  `start_date`).
- **`metros.timezone TEXT`** (IANA, default `America/New_York`) — reworked
  from the June "timezone is a lab property" decision, because a live open
  cycle **has no lab FK** under the sub-cohort model (`00067`; see
  [`local-labs.md`](./local-labs.md)). Resolution rule:
  - the **cycle schedule** computes/renders in the **HQ default zone**
    (`America/New_York` until an HQ metro row says otherwise);
  - **sub-cohort surfaces** may resolve `pods.lab_id → metros.timezone` for
    display when a pod's metro differs.
  Wall-clock inputs ("close at 23:59") are interpreted in the schedule zone and
  stored as `timestamptz` instants; display converts back.
- `cycles.end_at` becomes **derived** (anchor + sum of spine durations), not a
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
      duration INTERVAL,
      starts_at TIMESTAMPTZ,  -- computed, cached
      ends_at   TIMESTAMPTZ,  -- computed, cached
      UNIQUE(cycle_id, phase_key)
    )

- **Spine phases** chain contiguously (`starts_at = prev.ends_at`; first =
  anchor); ordered and non-overlapping **by construction**.
- **Overlay windows** (`pod_active_join`; the always-on pulse track stays
  outside) anchor independently (to an event ± offset) and **may overlap** the
  spine — pod active-join deliberately spans the project stage.
- A window is "open" iff `now ∈ [starts_at, ends_at)`; the resolver reads
  `cycle_phases` instead of `cycle_config` columns.
- **Pod forming/active-join** are two phase rows replacing the old
  `pod_registration` — the reconciliation with
  [`pod-registration.md`](./pod-registration.md).
- Org-mode cycles get **no phase rows** (or the resolver keeps its org-reject
  guard — same effect; the guard is the simpler invariant).

### Events as rows (`cycle_events`) — absorbing models 2 and 4

    cycle_events(
      id, cycle_id FK,
      key,            -- 'kickoff' | 'problem_sprint' | 'meet_the_pods'
                      --  | 'hackathon' | 'meet_the_projects' | 'summit' | …
      label, occurs_at TIMESTAMPTZ,   -- pinned absolute instant
      luma_api_id TEXT NULL,          -- when synced from Luma (00035)
      UNIQUE(cycle_id, key)
    )

- **Pinned** venue-bound dates that do not slide; phases may anchor to them.
- `cycle_events` **retires two of the four time models**:
  - `lib/cycles/anchor-events.ts` — the hardcoded constant becomes seed data;
    the Luma sync (`00035`) upserts `occurs_at`/`luma_api_id`, fulfilling that
    file's own "interim until the events cache lands" note.
  - `cycle_config.phase_2_start`/`phase_3_start` — become the
    `meet_the_pods` / `meet_the_projects` event rows;
    `cycle-phase-indicator.tsx` reads events + phases; columns then drop.
- Events are point-in-time markers; they don't gate app windows by themselves
  (a phase does that), but they anchor the schedule and drive comms/UI.

### The week grid — re-anchoring model 3

`getCycleWeek` (`lib/cycle/week.ts`) and the milestone-week config (`00047`)
stay — they answer "what week are we in," which phases don't. Two changes only:

- The grid derives from **`start_at`/derived `end_at`** (same anchor as
  phases) instead of the free-floating `start_date`/`end_date`.
- Week boundaries compute in the schedule timezone (a week flips at local
  midnight, not UTC).

`milestone_mid_week`/`milestone_final_week` remain admin-editable config; the
learning-log cadence is otherwise untouched.

### Two tracks: events vs. software actions

Unchanged from June — a cycle timeline has **two independent tracks** sharing
the calendar: **events** (community gatherings, pinned) and **software
actions** (the in-app windows = `cycle_phases`, derived). They interleave but
neither gates the other.

### Advancement

Phases are **time-driven** — the clock opens/closes them via
`starts_at`/`ends_at`; no admin click advances the cycle. `advance-phase`
becomes an **override** ("close early / extend"), adjusting a duration and
recomputing downstream; the 24h hardcode goes away. It stays a
`testing:use`-gated tool.

## Cycle template — relative schedule

Unchanged in substance from June (13-week, Tuesday-anchored; events carry
per-cycle-overridable offsets from start; software windows anchor to events
with weekday-snap deadlines). Retained as the instantiation spec:

| Anchor | Relative rule (default) | Cycle 3 instance |
|---|---|---|
| Cycle **start** | input — a Tuesday + timezone | Tue Jul 14, America/New_York |
| **Problem Sprint** (event) | start + 11 days (Sat, wk 2) | Sat Jul 25 |
| **Meet the Pods** (event) | start + 4 weeks (Tue) | Tue Aug 11 |
| **Hackathon** (event) | start + 30 days (Thu, wk 5) | Thu Aug 13 |
| **Meet the Projects** (event) | start + 8 weeks (Tue) | Tue Sep 8 |
| **Summit** (event) = cycle **end** | start + 13 weeks (Tue) | Tue Oct 13 |

| Window | Opens | Closes |
|---|---|---|
| Problem statement | Sprint, 9:00am | Sprint, 12:00pm |
| Pod voting | Sprint, 12:00pm | Sprint, 1:00pm |
| Pod forming | Sprint, 1:00pm | Tuesday after Sprint, midnight |
| Pod active-join | Meet the Pods, 12:00am | = Project registration close |
| Project proposal | Hackathon (Thu) | Tuesday after Hackathon |
| Project voting | Tuesday after Hackathon | Thursday after Hackathon |
| Project registration | Thursday after Hackathon | 2nd Tuesday after Hackathon |

"**\<Weekday\> after X**" = the first such weekday strictly after X.

> **Timing reality (2026-07-12): Cycle 3 starts Jul 14 — this scaffolding will
> not exist by then.** Cycle 3 runs on the manual window columns as today; its
> dates above serve as the template's worked example and the migration test
> fixture. The derived timeline **targets Cycle 4** (or a deliberate mid-Cycle-3
> retrofit, which is explicitly out of scope unless separately decided — see
> [`implementation-plan.md`](./implementation-plan.md)).

## Functional requirements

- **FR-1** Add `cycles.start_at TIMESTAMPTZ` (backfill from `start_date`) with
  derived `end_at`; add `metros.timezone` (default `America/New_York`). All
  scheduling math/display uses the resolution rule above.
- **FR-2** Create `cycle_phases`; seed the default phase sequence with default
  durations (Cycle-3 template values) on cycle creation.
- **FR-3** A schedule service computes/stores `starts_at`/`ends_at` for all
  phases from anchor + durations + event pins; recomputes on any change.
- **FR-4** Create `cycle_events`; seed from `anchor-events.ts`; wire the Luma
  sync (`00035`) to upsert into it; migrate `phase_2_start`/`phase_3_start`
  into `meet_the_pods`/`meet_the_projects` rows and update
  `cycle-phase-indicator.tsx`; then drop the two columns and retire
  `anchor-events.ts`.
- **FR-5** `advance-phase` becomes duration-override + recompute; remove the
  24h hardcode; keep the `testing:use` gate and org-reject.
- **FR-6** Validation: spine stays ordered/contiguous by construction;
  overlays may overlap; any explicit pin keeps `start<end` and stays within
  the cycle.
- **FR-7** Admin schedule UI shows the derived timeline (phase → computed
  start/end in the schedule tz) and edits durations/anchors, not raw
  timestamps.
- **FR-8 (week grid)** `getCycleWeek` + milestone weeks read
  `start_at`/derived `end_at` and compute week boundaries in the schedule tz;
  learning-log behavior otherwise unchanged.
- **FR-11 (single window resolver)** Route **all** window checks through one
  tz-aware resolver backed by `cycle_phases` — the ~8 API routes +
  `lib/projects/finalize.ts` that already call `checkWindow`, **and every UI
  page/component that today re-derives windows inline** (~22 files with
  `_open`/`_close` references — the server pages resolve windows server-side
  and pass results down). Delete the inline `now >= open && now <= close`
  re-implementations and per-file `DAY_MS` offsets. Keep the org-mode reject.
- **FR-12 (phase keys)** The resolver's `WindowField` + `WINDOW_MESSAGES`
  extend to the new phase set (`pod_forming`, `pod_active_join`,
  `project_proposal`, …) and remain the single enumeration of windows.
- **FR-13 (validation surface)** Replace `lib/validations/cycles.ts`
  config/window validation with schedule-template validation (anchor + event
  dates + durations).
- **FR-14 (display tz)** UI date formatting renders in the **schedule's**
  timezone **with the tz label shown** ("Aug 13, 2026, 12:00 PM EDT"), not the
  browser's local time. (Note: `lib/format/date.ts` currently pins UTC purely
  as an SSR-hydration fix — replace with schedule-tz formatting.)
- **FR-15 (cron tz)** Participant-facing crons (learning-log/leadership-log
  reminders and windows, the re-scheduled revocation check per
  [`pod-registration.md`](./pod-registration.md)) fire at a **cycle-local
  morning hour**. Vercel cron is UTC-only: pin the UTC equivalent (mind DST)
  or run hourly and gate to the schedule's local hour.

## Schema & migration

- Add `cycles.start_at` (backfill: `start_date AT TIME ZONE` the verified
  source zone) + `metros.timezone`; create `cycle_phases`, `cycle_events`.
- Migrate the twelve `cycle_config.*_open/close` values into phase rows
  (derive each `duration` from the old span), splitting `pod_registration` →
  `pod_forming` + `pod_active_join`; keep the non-window `cycle_config`
  columns (thresholds, `pod_limit`, milestone weeks, pulse tuning). Then drop
  the window columns + `phase_2_start`/`phase_3_start`.
- **timestamptz conversion is PER-COLUMN — never blanket:**
  - **Audit columns** (`created_at`, `granted_at`, `joined_at`, …) were written
    by `CURRENT_TIMESTAMP` in a UTC session → convert `USING col AT TIME ZONE
    'UTC'`. Reinterpreting them as Eastern shifts dozens of columns by 4–5h —
    data corruption.
  - **Scheduling columns** (the 12 window columns, `start_date`/`end_date`,
    `phase_2/3_start`, `events.start_at/end_at` — the last documented in
    SCHEMA.md as "local wall time") are Eastern *candidates*, but **verify
    against real prod values per column before choosing** (a write path using
    `.toISOString()` already stored UTC instants). This is the one
    irreversible data step — dry-run on a prod clone.
- New tables since ~`00033` already use `TIMESTAMPTZ`; they need no change.

## Acceptance criteria

- Changing `cycles.start_at` shifts every phase boundary and the week grid;
  spine phases stay ordered and contiguous with no manual edits.
- A window opens/closes by the clock at its computed boundary in the schedule
  timezone (a 23:59 close in `America/New_York` closes at local 23:59, not
  UTC — including across a DST transition).
- Pod forming and active-join are two phases; the pod-registration flow reads
  them like any other window.
- It is impossible to save spine phases that overlap or go out of order;
  overlays may overlap the spine by design.
- `cycle-phase-indicator.tsx` renders from `cycle_events` + `cycle_phases`;
  `phase_2_start`/`phase_3_start` and `anchor-events.ts` are gone.
- `grep -r "_open\|_close" app/` finds no inline window comparisons — every
  check goes through the resolver.
- Learning-log milestone timing is unchanged for a cycle whose
  `start_at`/`end_at` equal its old `start_date`/`end_date`.

## Decisions log

- **2026-06-17** — Timeline is cycle-relative/derived; phases are rows;
  spine/overlay; hybrid pinned-events + derived-phases; display in schedule tz
  with label; participant crons at cycle-local morning; reusable relative
  template (13-week, Tuesday-anchored); events vs software actions are two
  independent tracks. *(All retained.)*
- **2026-06-17 (D-3, revised on stress-test)** — timestamptz conversion is
  **per-column** (audit = UTC; scheduling = verify then convert). *(Retained.)*
- **2026-06-17 (D-4)** — ~~timezone is a lab property; a cycle uses its lab's
  zone~~ — **reworked 2026-07-12**: live open cycles have no lab
  (`00067`); timezone lives on `metros` with an HQ default; schedule uses the
  HQ zone, sub-cohort surfaces may localize display.
- **2026-06-17 (D-5/D-8)** — pulse/invite/reminder offsets stay code
  constants; pulse + invite tracks stay independent of the schedule.
  *(Retained.)*
- **2026-07-12 (re-baseline)** — The shipped **week grid + milestone weeks**
  (`lib/cycle/week.ts`, `00047`) are kept and re-anchored, not replaced.
  `cycle_events` absorbs `anchor-events.ts` (as Luma-cache landing table) and
  `phase_2/3_start`. The June claim that `start_date`/`end_date` are "never
  read" and `phase_2/3_start` "dead" was already false at merge time — both
  are live; both must be *migrated*, not dropped.
- **2026-07-12** — Cycle 3 (starts Jul 14) runs on the manual window columns;
  the derived timeline targets **Cycle 4** unless a mid-cycle retrofit is
  separately decided.

## Open decisions

- **T-1** — Mid-Cycle-3 retrofit vs. Cycle-4 target (default: Cycle 4).
- **T-2** — Does the schedule zone come from an explicit HQ `metros` row
  (`is_default = true`) or a platform setting? (Either satisfies FR-1; pick
  during implementation.)
- **T-3** — `pulse_checks.scheduled_date` (DATE) "today" derivation: switch to
  schedule-tz "today" during FR-15, or leave as a known minor skew.
