# Requirements — Pod Registration

| | |
|---|---|
| **Status** | Draft — for review |
| **Author** | (you) |
| **Last updated** | 2026-06-17 |
| **Related code** | `app/api/pods/[pod_id]/register/route.ts`, `lib/auth/windows.ts`, `cycle_phases` (per `cycle-timeline.md`), `app/(dashboard)/cycles/[cycle_id]/register-pods/` |
| **Related docs** | [`cycle-timeline.md`](./cycle-timeline.md) (defines the two windows as phases), `docs/OLOS-architecture-brief.md`, `SCHEMA.md` (Pod Layer) |

## Overview

Pod registration is being restructured to **separate two things that are
currently fused**:

1. **The ability to register** is split into **two windows keyed to pod
   status** — a *forming* window (help assemble a pod) and a later *active*
   window (join a pod that has already formed).
2. **Pod membership is decoupled from cycle participation** — joining a pod no
   longer flips a participant's `cycle_enrollments` to `active`. Being an
   "active participant" in the cycle becomes its own rule, independent of pods.

## Current state (as-is)

Today, registration (`app/api/pods/[pod_id]/register/route.ts`) is a single
flow with a **three-way coupling**:

```
register ──drives──▶ pod status (forming → active) ──drives──▶ cycle enrollment (inactive → active)
```

- One `pod_registration` time window (`cycle_config.pod_registration_open/close`).
- Registration allowed when pod status ∈ {`forming`,`active`} **and** the window
  is open.
- When a `forming` pod reaches `cycle_config.pod_min`, registering flips it to
  `active` **and** flips every member's `cycle_enrollments` to `active`. If the
  pod is already `active`, the new registrant's enrollment flips immediately.

So `forming`/`active` is simultaneously a gate, a consequence of registration,
and the trigger for cycle participation. This redesign untangles that.

## Goals

- Registration availability is governed by **explicit per-status windows**, not
  by a single window plus a status side-channel.
- A participant's cycle-participation status does **not** depend on whether
  their pod formed.
- The forming → active transition is an explicit, well-defined event (not a
  side effect of an individual registration).

## Non-goals

- Changing how pods are created (voting finalize still seeds `forming` pods).
- The project layer (solution proposals / project registration) — out of scope
  here; mirror later if desired. **Stress-test note:** `projects/[id]/register`
  *already* never touches `cycle_enrollments` (it only flips `projects.status`) and
  requires active pod membership, so decoupling pods actually makes the two layers
  *consistent*, not divergent. One interaction to confirm as acceptable: because
  `pod_active_join` overlaps project registration (both close Aug 25 in Cycle 3), a
  participant who joins an active pod on the last day can immediately register a
  project.

> **Sequencing (stress-test):** this change **depends on Doc D (cycle-timeline)** —
> its two windows are `cycle_phases` rows and the rewritten cron reads the
> `pod_forming`/`pod_active_join` boundaries. Build order is
> `labs → timeline → pod-registration → auth`; pod-registration lands **after**
> timeline, not before.

## Glossary

| Term | Meaning |
|---|---|
| **forming** | A pod still assembling its initial membership. |
| **active** | A pod that has formed (met the threshold) and is running. |
| **inactive** | A pod that never formed, or has ended/dissolved. |
| **forming window** | The period during which participants may join `forming` pods. |
| **active window** | A separate, later period during which participants may join `active` pods (late/secondary joins). |

## Target model

### Pod lifecycle

```
forming  ──(forming window closes; threshold met)──▶  active  ──(cycle ends)──▶  inactive
   └──────────────(threshold NOT met)──────────────▶  inactive (dissolved)
```

The **forming → active transition is an explicit event**, not a per-registration
trigger (see D-1 for what fires it). Pods that fail to reach `pod_min` by the end
of the forming window are dissolved (`inactive`).

### Two registration windows

Registration is allowed when the window matching the pod's **current status** is
open:

| Pod status | Window required | Purpose |
|---|---|---|
| `forming` | **forming window** open | Assemble the pod up toward `pod_min` (no max — D-3). |
| `active` | **active window** open | Late/secondary joins into a pod that already formed. |
| `inactive` | — | Never; registration refused. |

Both windows are **phases in the cycle timeline** — `pod_forming` and
`pod_active_join` rows in `cycle_phases`, replacing the old single
`pod_registration` phase. See [`cycle-timeline.md`](./cycle-timeline.md).

- `pod_forming` is a **spine** phase — sequential, on the sprint day (Cycle 3:
  Jul 25 1pm → Jul 28).
- `pod_active_join` is an **overlay** window anchored to *Meet the Pods →
  project-registration close*, so it **deliberately overlaps the project stage**
  (Cycle 3: Aug 11 → Aug 25, spanning project proposal / voting / registration).

These are two genuinely separate join windows — the overlap with the project
stage is intended, not a scheduling error.

### Cycle enrollment — phase-dependent (D-2)

Individual pod registrations **no longer mutate `cycle_enrollments`** (the old
per-join side effect is gone). Instead, active status is a **phase-dependent
rule**:

- **Before pods form:** active = enrolled in an active cycle; pods are
  irrelevant.
- **After pods form:** a participant must be **in a pod** to stay active;
  pod-less enrollees go inactive — this is the existing "in no pods → revoke"
  cron logic, evaluated at/after the pod-formation boundary.

### Caps & constraints

- A participant may be in at most **2 pods per cycle** (D-4), same in both
  windows.
- `UNIQUE(participant_id, pod_id)` prevents double-joining the same pod.
- **No per-pod maximum** (D-3) — pods may grow unbounded; only `pod_min` matters.

### Leave / switch

Leaving (`DELETE`) is allowed whenever a registration window the participant
qualifies for is open. **Once a pod is active it stays active** even if a
departure drops it below `pod_min` (D-5).

## Functional requirements

- **FR-1** Define the two windows as `pod_forming` and `pod_active_join` phases
  in `cycle_phases` (replacing the old `pod_registration` phase), per
  [`cycle-timeline.md`](./cycle-timeline.md). `lib/auth/windows.ts` resolves both
  from the timeline.
- **FR-2** `POST /api/pods/[pod_id]/register` checks the window **matching the
  pod's status**: `forming` → `pod_forming` phase; `active` → `pod_active_join`
  phase; `inactive` → refuse. It no longer touches `cycle_enrollments`.
- **FR-3** Remove the auto-activation side effect from the register endpoint.
  The forming → active transition moves to the mechanism chosen in D-1.
- **FR-4** The forming → active pod-status evaluation (D-1) happens at the
  `pod_forming` phase boundary (when that phase closes in the timeline).
- **FR-5** Cycle-participation status (`cycle_enrollments.status`) follows the
  phase-dependent rule (D-2): enrollment-based before pods form; pod-membership-
  gated after. Not mutated by individual registrations.
- **FR-6** The participant UI (`register-pods/`) shows the correct window state
  per pod status and a clear message when neither window is open.

## Acceptance criteria

- During the forming window, a participant can join a `forming` pod; they cannot
  join an `active` one (and vice-versa for the active window).
- Joining or leaving a pod does **not** change the participant's
  `cycle_enrollments.status`.
- A pod that never reaches `pod_min` ends as `inactive`; its would-be members
  are freed to join an active pod and notified (D-6).
- After pods form, a participant in no pod is not cycle-active (D-2).

## Decisions log

- **2026-06-17** — Split registration into two status-keyed windows: a forming
  window and a separate active-join window.
- **2026-06-17** — Decouple pod membership from cycle participation; joining a
  pod no longer activates `cycle_enrollments`.
- **2026-06-17 (decision sweep)** — D-1 forming→active at the `pod_forming`
  phase close; D-2 active rule is **phase-dependent** (enrollment-based pre-pods;
  pod-gated post-pods, via the in-no-pods revocation); D-3 **no per-pod max**;
  D-4 cap of **2 pods/cycle** in both windows; D-5 active pods **stay active**;
  D-6 orphaned members **freed to join an active pod + notified**; D-7
  **first-come self-serve** (`preference_rank` legacy-only).

## Open decisions

*All resolved 2026-06-17 (decision sweep):*

- **D-1 → At `pod_forming` phase close** — pods with ≥ `pod_min` become active,
  the rest dissolve (the timeline phase boundary triggers it).
- **D-2 → Phase-dependent active rule.** **Before pods form:** cycle-active is
  enrollment-based, *not* linked to pods. **After pods form:** a participant
  must be in a pod to be active — pod-less enrollees go inactive. Individual
  registrations no longer mutate `cycle_enrollments` directly.

  **⚠ Stress-test correction — "ties to the existing cron" understates two things:**
  1. **The cron is NOT phase-gated today** (`cron/revocation-check`, daily, runs
     unconditionally). The only reason it doesn't already revoke everyone is that
     enrollments stay `inactive` until a pod-join flips them `active` — i.e. the
     coupling we are removing is exactly what protects the cron. **Decoupling
     requires rewriting the cron to be phase-aware** (read the boundary from
     `cycle_phases`), and the cron now **depends on the timeline (Doc D)**.
  2. **A replacement activation trigger is required.** Once pod-join stops setting
     `status='active'`, *nothing* activates a self-registered enrollee (invite-callback
     sets `active`, but `interest`/`registrations`/`short` set `inactive`). Decision:
     **enrolling into an open cycle ⇒ `status='active'`** (set it at enrollment time).
     Pre-pod active = enrolled-in-open-cycle; post-pod active = in a pod.
  3. **Revoke boundary = `pod_active_join` close, not `pod_forming` close.** Applying
     "in no pods → revoke" at the *forming* boundary creates a dead-zone (forming
     closes Jul 28, active-join opens Aug 11) where freed orphans can't yet join but
     get revoked the next morning — contradicting D-6. Gating revocation to
     **after `pod_active_join.ends_at`** removes the dead-zone: a participant is only
     revoked for being pod-less once their *last* chance to join has passed. (The
     pulse-check arm of the cron is unchanged.)
- **D-3 → No per-pod maximum.** Pods may grow unbounded (as today); only
  `pod_min` matters.
- **D-4 → Up to 2 pods per cycle**, same cap across the forming and active-join
  windows.
- **D-5 → Once active, a pod stays active** regardless of later departures.
- **D-6 → Free orphaned members to join an active pod (+ notify)** when their
  forming pod dissolves; no silent limbo. **Stress-test notes:** (a) pod
  **dissolution code does not exist today** — nothing sets a pod `inactive`; this is
  net-new and fires at the `pod_forming` phase boundary (D-1). (b) The **notification
  mechanism is also net-new** (no in-app/email notification path exists for this).
  (c) The dead-zone between forming-close and active-join-open is resolved by gating
  revocation to `pod_active_join` close (see D-2.3), so "freed" members actually have
  a window to land in before any revocation.
- **D-7 → First-come self-serve**; `preference_rank` stays legacy-only (unused).
