# Requirements — Pod Registration

| | |
|---|---|
| **Status** | Draft — for review (**re-baselined 2026-07-12** against the reconciler + rewritten revocation cron; original 2026-06-17) |
| **Related code** | `app/api/pods/[pod_id]/register/route.ts`, `lib/enrollment/reconciler.ts`, `lib/auth/windows.ts`, `app/api/cron/revocation-check/route.ts`, `lib/cycle/closeout.ts`, `app/(dashboard)/cycles/[cycle_id]/register-pods/` |
| **Related docs** | [`cycle-timeline.md`](./cycle-timeline.md) (**prerequisite** — defines the two windows as phases), `SCHEMA.md` (Pod Layer) |

## Overview

Pod registration is being restructured to **separate two things that are
currently fused**:

1. **The ability to register** is split into **two windows keyed to pod
   status** — a *forming* window (help assemble a pod) and a later *active*
   window (join a pod that has already formed).
2. **Pod membership stops driving cycle participation.** Joining a pod no
   longer promotes a participant's `cycle_enrollments`; being an "active
   participant" becomes its own phase-dependent rule.

This is the surviving core of the June 2026 doc. Several of its premises have
since been overtaken by shipped code — the re-baseline below states what is
still true, what already changed, and what the redesign still has to do.

## Current state (as-is, July 2026)

- **Still one window.** Registration is gated on the single `pod_registration`
  window via `checkWindow` (`register/route.ts`), for pods in
  `forming`/`active` status alike.
- **Join still drives enrollment — but through one seam now.** The old inline
  side effects were centralized into `lib/enrollment/reconciler.ts`:
  `reconcileEnrollmentActivation` (joiner/leaver), `reconcilePodMembers` (on
  pod activation), `ensureActivePodMembership` (invite/co-lead path). The
  *coupling* this doc removes still exists, but it now lives in exactly one
  place — the redesign is a **policy change inside the reconciler**, not a
  scavenger hunt for side effects.
- **forming→active still flips at `pod_min`** inside the register route when a
  forming pod reaches threshold.
- **The pod cap is config, not code.** `cycle_config.pod_limit` (default
  **1**, `00043`) — the June doc's "hardcoded 2" is gone; see D-4 (revised).
- **Pods are metro-fenced.** `pods.lab_id` is the pod's sub-cohort; a trigger
  (`00068_pods_local`) requires `participants.metro_id = pods.lab_id` for
  active open-mode lab pods. Any new join path must respect the fence.
- **Dissolution exists, but only at cycle close-out.** `00063` added the
  terminal `dissolved` status, written by `lib/cycle/closeout.ts` when a cycle
  is archived/closed. Nothing dissolves a sub-`pod_min` pod at the end of
  forming.
- **The revocation cron was rewritten — and unscheduled.**
  `cron/revocation-check` is now phase-gated (its "in no pods" arm only fires
  after `pod_registration_close`), two-stage (warn → 3-day grace → revoke,
  `00030`), reconciler-driven, admin/owner-exempt, and cycle-scoped. But it is
  **absent from `vercel.json`** (removed in PR #108); today it only runs if
  invoked manually. Re-scheduling it is part of this work.
- Org-mode cycles (`mode='org'`) have no formation windows at all
  (`checkWindow` rejects them); everything here concerns open-mode.

## Goals

- Registration availability is governed by **explicit per-status windows**, not
  by a single window plus a status side-channel.
- A participant's cycle-participation status does **not** depend on whether
  their pod formed.
- The forming → active transition is an explicit, well-defined event (not a
  side effect of an individual registration).

## Non-goals

- Changing how pods are created (voting finalize still seeds `forming` pods).
- The project layer — `projects/[id]/register` already never touches
  enrollment and requires active pod membership, so this change makes the two
  layers *consistent*. One interaction to accept: with `pod_active_join`
  overlapping project registration, a last-day pod joiner can immediately
  register a project.
- The metro fence (`00068`) — it stays exactly as is in both windows.

> **Sequencing:** this change **depends on
> [`cycle-timeline.md`](./cycle-timeline.md)** — the two windows are
> `cycle_phases` rows, and the revocation gate reads the `pod_active_join`
> boundary. Build order: timeline → pod-registration (see
> [`implementation-plan.md`](./implementation-plan.md)).

## Glossary

| Term | Meaning |
|---|---|
| **forming** | A pod still assembling its initial membership. |
| **active** | A pod that has formed (met the threshold) and is running. |
| **inactive / dissolved** | Never formed (dissolved at forming-close), or ended with its cycle (close-out, `00063`). |
| **forming window** | `pod_forming` phase — participants may join `forming` pods. |
| **active window** | `pod_active_join` overlay phase — participants may join `active` pods (late/secondary joins). |

## Target model

### Pod lifecycle

```
forming ──(forming window closes; ≥ pod_min)──▶ active ──(cycle close-out)──▶ dissolved
   └─────────────(< pod_min at forming close)──▶ dissolved (never formed)
```

- The **forming → active transition fires at the `pod_forming` phase
  boundary** (D-1), not per-registration. The `pod_min` check moves out of the
  register route into that boundary event.
- Pods under `pod_min` at forming-close are **dissolved** — reusing `00063`'s
  terminal status with a new trigger point (today only close-out writes it).
  Members are freed and notified (D-6).

### Two registration windows

Registration is allowed when the window matching the pod's **current status**
is open:

| Pod status | Window required | Purpose |
|---|---|---|
| `forming` | `pod_forming` open | Assemble the pod toward `pod_min` (no per-pod max — D-3). |
| `active` | `pod_active_join` open | Late/secondary joins into a formed pod. |
| `inactive`/`dissolved` | — | Refused. |

Both windows are **phases in the cycle timeline** (`pod_forming` spine,
`pod_active_join` overlay — the overlay deliberately spans the project stage).
`checkWindow`/its successor resolves both; the metro fence and
`cycle_config.pod_limit` apply identically in both windows.

### Cycle enrollment — phase-dependent (D-2)

Pod joins/leaves **no longer promote or demote `cycle_enrollments`**.
Concretely: the reconciler's activation policy changes from "in an active pod
⇒ active" to:

- **Before pods form** (through `pod_active_join` close): active = enrolled in
  the open cycle. Enrollment paths (`interest`, `registrations`,
  `registrations/short`, invite fulfillment) set/keep `status='active'`
  directly — enrollment *is* activation pre-pods.
- **After `pod_active_join` closes:** a participant must be in an active pod
  to stay active; pod-less enrollees are handled by the revocation cron's
  "in no pods" arm.

### Revocation cron (delta from today)

The cron's structure survives as-is (two-stage warn→grace→revoke,
reconciler-driven, exemptions). Two changes:

1. **Move the "in no pods" gate** from `pod_registration_close` to
   **`pod_active_join.ends_at`** (read from `cycle_phases`). This closes the
   orphan dead-zone: members freed by a forming-close dissolution have the
   whole active-join window to land somewhere before any revocation.
2. **Re-schedule it.** Add the cron back to `vercel.json` (it has been
   unscheduled since PR #108); cadence and hour per
   [`cycle-timeline.md`](./cycle-timeline.md) FR-15 (cycle-local morning).

A participant revoked earlier must be reactivatable if they join a pod during
`pod_active_join` (the reconciler already handles revoked→active transitions;
verify this path).

### Caps & constraints

- Per-participant cap = **`cycle_config.pod_limit`** (default 1), enforced the
  same in both windows (D-4, revised).
- `UNIQUE(participant_id, pod_id)` still prevents double-joining; soft-delete
  reactivation (`inactive_at`) stays.
- **No per-pod maximum** (D-3) — only `pod_min` matters.
- Metro fence (`00068`) applies in both windows.

### Leave / switch

Leaving (`DELETE`) is allowed whenever a window the participant qualifies for
is open. Leaving no longer demotes enrollment (D-2). **Once a pod is active it
stays active** even if a departure drops it below `pod_min` (D-5).

## Functional requirements

- **FR-1** Define `pod_forming` and `pod_active_join` phases in the timeline
  (per [`cycle-timeline.md`](./cycle-timeline.md)); the window resolver gains
  both keys, replacing `pod_registration`.
- **FR-2** `POST /api/pods/[pod_id]/register` checks the window **matching the
  pod's status** (`forming`→`pod_forming`; `active`→`pod_active_join`;
  otherwise refuse). Metro fence and `pod_limit` unchanged.
- **FR-3** Remove the register-route side effects: no `pod_min` flip, no
  enrollment promotion. The reconciler's policy becomes phase-dependent (D-2);
  enrollment paths set `active` at enrollment time.
- **FR-4** A `pod_forming`-close boundary event activates pods ≥ `pod_min`
  (via `reconcilePodMembers` semantics) and **dissolves** the rest, freeing
  members (net-new trigger point for `00063`'s status).
- **FR-5** Orphan notification: members of a dissolved pod are notified they
  can join an active pod until `pod_active_join` closes. (Notification
  mechanism is net-new — email via `lib/email/` is the available channel.)
- **FR-6** Revocation cron: gate moves to `pod_active_join.ends_at`; cron
  re-registered in `vercel.json`.
- **FR-7** `register-pods/` UI shows the correct window state per pod status
  and a clear message when neither window is open.

## Acceptance criteria

- During `pod_forming`, a participant can join a `forming` pod but not an
  `active` one; vice-versa during `pod_active_join`.
- Joining or leaving a pod never changes `cycle_enrollments.status`.
- At forming-close, pods ≥ `pod_min` become active; the rest are `dissolved`,
  their members freed and notified.
- No pod-less enrollee is warned or revoked before `pod_active_join` closes;
  after it closes, the two-stage warn→grace→revoke behavior applies as today.
- A previously revoked participant who joins during `pod_active_join` is
  reactivated.
- The metro fence and `pod_limit` behave identically in both windows.

## Decisions log

- **2026-06-17** — Two status-keyed windows; decouple pod membership from
  cycle participation; forming→active as an explicit boundary event.
- **2026-06-17 (decision sweep)** — D-1 flip at forming close; D-2
  phase-dependent activation; D-3 no per-pod max; D-5 active pods stay active;
  D-6 orphans freed + notified; D-7 first-come self-serve (`preference_rank`
  legacy-only).
- **2026-07-12 (re-baseline)** — D-4 **revised**: the cap is
  `cycle_config.pod_limit` (shipped `00043`, default **1**) — the June "2 pods
  per cycle" decision is superseded; raising it is a config change, not code.
- **2026-07-12 (re-baseline)** — The June stress-test's "rewrite the cron /
  add an activation trigger" corrections are **partially shipped**: the cron
  is already phase-gated + two-stage + reconciler-driven (but unscheduled);
  activation policy lives in the reconciler. Remaining deltas are FR-3/FR-6.
- **2026-07-12** — Dissolution reuses `00063`'s `dissolved` status with a new
  forming-close trigger point (close-out dissolution unchanged).

## Open decisions

- **D-8** — Notification channel for dissolved-pod orphans: email only, or
  also an in-app banner on `register-pods/`? (Email exists via `lib/email/`;
  in-app is net-new.)
- **D-9** — Should enrollment paths retroactively activate existing
  `inactive` enrollees at cutover, or only apply the new rule to new
  enrollments? (Affects the FR-3 migration moment mid-cycle.)
